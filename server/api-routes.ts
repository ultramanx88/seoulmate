import { randomUUID } from 'node:crypto';
import type { Request, Response, Router } from 'express';
import express from 'express';
import { config } from './config.js';
import { database } from './database.js';

type AuthProvider = 'google' | 'line' | 'kakao' | 'naver';
type AppUserRow = {
  id: string;
  auth_provider: string;
  provider_subject: string | null;
  email: string | null;
  email_verified: boolean;
  display_name: string;
  photo_url: string | null;
  nationality: 'TH' | 'KR' | null;
  intent: 'dating' | 'friendship' | 'exchange' | null;
  interests: string[];
  languages: string[];
  bio: string | null;
  is_profile_complete: boolean;
  last_active_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type ProviderProfile = {
  provider: AuthProvider;
  providerSubject: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string;
  photoUrl: string | null;
};

const sessionCookieName = 'seoulmate_auth_session';
const sessionTtlSeconds = 60 * 60 * 24 * 7;
const oauthProviders = ['google', 'line', 'kakao', 'naver'] as const;

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((part) => {
      const [rawKey, ...rawValue] = part.trim().split('=');
      return [rawKey, decodeURIComponent(rawValue.join('='))];
    }).filter(([key]) => key),
  );
}

function serializeCookie(
  name: string,
  value: string,
  options: { maxAge?: number; path?: string; httpOnly?: boolean } = {},
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path ?? '/'}`,
    'SameSite=Lax',
  ];
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (config.NODE_ENV === 'production') parts.push('Secure');
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  return parts.join('; ');
}

function authSuccessUrl(provider: AuthProvider): string {
  const url = new URL(config.AUTH_SUCCESS_URL || config.APP_URL);
  url.searchParams.set('auth', provider);
  return url.toString();
}

function authFailureUrl(reason: string): string {
  const url = new URL(config.AUTH_FAILURE_URL || config.APP_URL);
  url.searchParams.set('auth', 'failed');
  url.searchParams.set('reason', reason);
  return url.toString();
}

function providerRedirectUri(provider: AuthProvider): string {
  const explicit = {
    google: config.GOOGLE_REDIRECT_URI,
    line: config.LINE_REDIRECT_URI,
    kakao: config.KAKAO_REDIRECT_URI,
    naver: config.NAVER_REDIRECT_URI,
  }[provider];
  return explicit || `${config.APP_URL.replace(/\/$/, '')}/v1/auth/${provider}/callback`;
}

function providerConfigured(provider: AuthProvider): boolean {
  if (!config.AUTH_SESSION_SECRET) return false;
  if (provider === 'google') return Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);
  if (provider === 'line') return Boolean(config.LINE_CHANNEL_ID && config.LINE_CHANNEL_SECRET);
  if (provider === 'kakao') return Boolean(config.KAKAO_REST_API_KEY);
  return Boolean(config.NAVER_CLIENT_ID && config.NAVER_CLIENT_SECRET);
}

function toUserProfile(row: AppUserRow) {
  return {
    uid: row.id,
    id: row.id,
    authProvider: row.auth_provider,
    providerSubject: row.provider_subject,
    email: row.email,
    emailVerified: row.email_verified,
    displayName: row.display_name,
    photoURL: row.photo_url ?? '',
    photoUrl: row.photo_url,
    nationality: row.nationality ?? undefined,
    intent: row.intent ?? undefined,
    interests: row.interests ?? [],
    languages: row.languages ?? [],
    bio: row.bio ?? '',
    isProfileComplete: row.is_profile_complete,
    lastActiveAt: row.last_active_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function getCurrentUser(request: Request): Promise<AppUserRow | null> {
  const token = parseCookies(request.headers.cookie)[sessionCookieName];
  if (!token) return null;
  const result = await database.query<AppUserRow>(
    `
      SELECT u.*
      FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
      LIMIT 1
    `,
    [token],
  );
  if (!result.rowCount) return null;
  const user = result.rows[0];
  void database.query('UPDATE users SET last_active_at = now() WHERE id = $1', [user.id]);
  return user;
}

async function requireUser(request: Request, response: Response): Promise<AppUserRow | null> {
  const user = await getCurrentUser(request);
  if (!user) {
    response.status(401).json({ error: 'UNAUTHENTICATED' });
    return null;
  }
  return user;
}

async function createSession(request: Request, response: Response, userId: string): Promise<void> {
  const sessionId = randomUUID();
  await database.query(
    `
      INSERT INTO auth_sessions (id, user_id, user_agent, ip_address, expires_at)
      VALUES ($1, $2, $3, $4, now() + ($5::int * interval '1 second'))
    `,
    [
      sessionId,
      userId,
      request.headers['user-agent'] ?? null,
      request.ip,
      sessionTtlSeconds,
    ],
  );
  response.setHeader('Set-Cookie', serializeCookie(sessionCookieName, sessionId, { maxAge: sessionTtlSeconds }));
}

async function upsertProviderUser(profile: ProviderProfile): Promise<AppUserRow> {
  const userId = `${profile.provider}:${profile.providerSubject}`;
  const result = await database.query<AppUserRow>(
    `
      INSERT INTO users (
        id,
        auth_provider,
        provider_subject,
        email,
        email_verified,
        display_name,
        photo_url,
        last_active_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, now())
      ON CONFLICT (id) DO UPDATE SET
        auth_provider = EXCLUDED.auth_provider,
        provider_subject = EXCLUDED.provider_subject,
        email = COALESCE(EXCLUDED.email, users.email),
        email_verified = users.email_verified OR EXCLUDED.email_verified,
        display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), users.display_name),
        photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url),
        last_active_at = now()
      RETURNING *
    `,
    [
      userId,
      profile.provider,
      profile.providerSubject,
      profile.email,
      profile.emailVerified,
      profile.displayName || `${profile.provider} user`,
      profile.photoUrl,
    ],
  );
  return result.rows[0];
}

async function exchangeGoogle(code: string): Promise<ProviderProfile> {
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.GOOGLE_CLIENT_ID,
      client_secret: config.GOOGLE_CLIENT_SECRET,
      redirect_uri: providerRedirectUri('google'),
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenResponse.ok) throw new Error('google_token_exchange_failed');
  const token = await tokenResponse.json() as { access_token: string };
  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  if (!profileResponse.ok) throw new Error('google_profile_failed');
  const profile = await profileResponse.json() as {
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };
  return {
    provider: 'google',
    providerSubject: profile.sub,
    email: profile.email ?? null,
    emailVerified: Boolean(profile.email_verified),
    displayName: profile.name ?? profile.email ?? 'Google user',
    photoUrl: profile.picture ?? null,
  };
}

async function exchangeLine(code: string): Promise<ProviderProfile> {
  const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: providerRedirectUri('line'),
      client_id: config.LINE_CHANNEL_ID,
      client_secret: config.LINE_CHANNEL_SECRET,
    }),
  });
  if (!tokenResponse.ok) throw new Error('line_token_exchange_failed');
  const token = await tokenResponse.json() as { access_token: string };
  const profileResponse = await fetch('https://api.line.me/v2/profile', {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  if (!profileResponse.ok) throw new Error('line_profile_failed');
  const profile = await profileResponse.json() as {
    userId: string;
    displayName: string;
    pictureUrl?: string;
  };
  return {
    provider: 'line',
    providerSubject: profile.userId,
    email: null,
    emailVerified: false,
    displayName: profile.displayName,
    photoUrl: profile.pictureUrl ?? null,
  };
}

async function exchangeKakao(code: string): Promise<ProviderProfile> {
  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    redirect_uri: providerRedirectUri('kakao'),
    client_id: config.KAKAO_REST_API_KEY,
  });
  if (config.KAKAO_CLIENT_SECRET) body.set('client_secret', config.KAKAO_CLIENT_SECRET);
  const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!tokenResponse.ok) throw new Error('kakao_token_exchange_failed');
  const token = await tokenResponse.json() as { access_token: string };
  const profileResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  if (!profileResponse.ok) throw new Error('kakao_profile_failed');
  const profile = await profileResponse.json() as {
    id: number;
    kakao_account?: {
      email?: string;
      is_email_verified?: boolean;
      profile?: { nickname?: string; profile_image_url?: string };
    };
    properties?: { nickname?: string; profile_image?: string };
  };
  return {
    provider: 'kakao',
    providerSubject: String(profile.id),
    email: profile.kakao_account?.email ?? null,
    emailVerified: Boolean(profile.kakao_account?.is_email_verified),
    displayName: profile.kakao_account?.profile?.nickname ?? profile.properties?.nickname ?? 'Kakao user',
    photoUrl: profile.kakao_account?.profile?.profile_image_url ?? profile.properties?.profile_image ?? null,
  };
}

async function exchangeNaver(code: string, state: string): Promise<ProviderProfile> {
  const tokenUrl = new URL('https://nid.naver.com/oauth2.0/token');
  tokenUrl.searchParams.set('grant_type', 'authorization_code');
  tokenUrl.searchParams.set('client_id', config.NAVER_CLIENT_ID);
  tokenUrl.searchParams.set('client_secret', config.NAVER_CLIENT_SECRET);
  tokenUrl.searchParams.set('code', code);
  tokenUrl.searchParams.set('state', state);
  const tokenResponse = await fetch(tokenUrl);
  if (!tokenResponse.ok) throw new Error('naver_token_exchange_failed');
  const token = await tokenResponse.json() as { access_token: string };
  const profileResponse = await fetch('https://openapi.naver.com/v1/nid/me', {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  if (!profileResponse.ok) throw new Error('naver_profile_failed');
  const payload = await profileResponse.json() as {
    response: {
      id: string;
      email?: string;
      name?: string;
      nickname?: string;
      profile_image?: string;
    };
  };
  const profile = payload.response;
  return {
    provider: 'naver',
    providerSubject: profile.id,
    email: profile.email ?? null,
    emailVerified: Boolean(profile.email),
    displayName: profile.name ?? profile.nickname ?? profile.email ?? 'Naver user',
    photoUrl: profile.profile_image ?? null,
  };
}

function buildAuthorizeUrl(provider: AuthProvider, state: string): string {
  if (provider === 'google') {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', config.GOOGLE_CLIENT_ID);
    url.searchParams.set('redirect_uri', providerRedirectUri(provider));
    url.searchParams.set('state', state);
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'select_account');
    return url.toString();
  }
  if (provider === 'line') {
    const url = new URL('https://access.line.me/oauth2/v2.1/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', config.LINE_CHANNEL_ID);
    url.searchParams.set('redirect_uri', providerRedirectUri(provider));
    url.searchParams.set('state', state);
    url.searchParams.set('scope', 'profile openid email');
    return url.toString();
  }
  if (provider === 'kakao') {
    const url = new URL('https://kauth.kakao.com/oauth/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', config.KAKAO_REST_API_KEY);
    url.searchParams.set('redirect_uri', providerRedirectUri(provider));
    url.searchParams.set('state', state);
    url.searchParams.set('scope', 'profile_nickname profile_image account_email');
    return url.toString();
  }
  const url = new URL('https://nid.naver.com/oauth2.0/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.NAVER_CLIENT_ID);
  url.searchParams.set('redirect_uri', providerRedirectUri(provider));
  url.searchParams.set('state', state);
  return url.toString();
}

async function exchangeProvider(provider: AuthProvider, code: string, state: string): Promise<ProviderProfile> {
  if (provider === 'google') return exchangeGoogle(code);
  if (provider === 'line') return exchangeLine(code);
  if (provider === 'kakao') return exchangeKakao(code);
  return exchangeNaver(code, state);
}

function isProvider(value: string): value is AuthProvider {
  return oauthProviders.includes(value as AuthProvider);
}

function dateJson(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function topicJson(row: any, author: AppUserRow | null = null) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    intent: row.intent,
    likesCount: row.likes_count ?? 0,
    commentsCount: row.comments_count ?? 0,
    createdAt: dateJson(row.created_at),
    authorName: row.author_name ?? author?.display_name,
    authorPhoto: row.author_photo ?? author?.photo_url,
    authorNationality: row.author_nationality ?? author?.nationality,
  };
}

export function createApiRouter(): Router {
  const router = express.Router();

  router.get('/v1/auth/:provider/start', (request, response) => {
    const { provider } = request.params;
    if (!isProvider(provider)) {
      response.status(404).json({ error: 'UNKNOWN_PROVIDER' });
      return;
    }
    if (!providerConfigured(provider)) {
      response.status(503).json({ error: 'AUTH_PROVIDER_NOT_CONFIGURED', provider });
      return;
    }
    const state = randomUUID();
    response.setHeader(
      'Set-Cookie',
      serializeCookie(`seoulmate_oauth_state_${provider}`, state, {
        path: `/v1/auth/${provider}`,
        maxAge: 600,
      }),
    );
    response.redirect(buildAuthorizeUrl(provider, state));
  });

  router.get('/v1/auth/:provider/callback', async (request, response) => {
    const { provider } = request.params;
    if (!isProvider(provider)) {
      response.redirect(authFailureUrl('unknown_provider'));
      return;
    }
    const code = typeof request.query.code === 'string' ? request.query.code : '';
    const state = typeof request.query.state === 'string' ? request.query.state : '';
    const expectedState = parseCookies(request.headers.cookie)[`seoulmate_oauth_state_${provider}`];
    if (!code || !state || state !== expectedState) {
      response.redirect(authFailureUrl('invalid_state'));
      return;
    }
    try {
      const providerProfile = await exchangeProvider(provider, code, state);
      const user = await upsertProviderUser(providerProfile);
      await createSession(request, response, user.id);
      response.append(
        'Set-Cookie',
        serializeCookie(`seoulmate_oauth_state_${provider}`, '', {
          path: `/v1/auth/${provider}`,
          maxAge: 1,
        }),
      );
      response.redirect(authSuccessUrl(provider));
    } catch (error) {
      console.error('OAuth callback failed', error);
      response.redirect(authFailureUrl(`${provider}_callback_failed`));
    }
  });

  router.get('/v1/auth/me', async (request, response) => {
    const user = await getCurrentUser(request);
    if (!user) {
      response.status(401).json({ error: 'UNAUTHENTICATED' });
      return;
    }
    response.json({ user: toUserProfile(user), profile: toUserProfile(user) });
  });

  router.post('/v1/auth/logout', async (request, response) => {
    const token = parseCookies(request.headers.cookie)[sessionCookieName];
    if (token) {
      await database.query('UPDATE auth_sessions SET revoked_at = now() WHERE id = $1', [token]);
    }
    response.setHeader('Set-Cookie', serializeCookie(sessionCookieName, '', { maxAge: 1 }));
    response.json({ ok: true });
  });

  router.put('/v1/me/profile', async (request, response) => {
    const user = await requireUser(request, response);
    if (!user) return;
    const body = request.body as Partial<{
      displayName: string;
      nationality: 'TH' | 'KR';
      intent: 'dating' | 'friendship' | 'exchange';
      bio: string;
    }>;
    const result = await database.query<AppUserRow>(
      `
        UPDATE users
        SET
          display_name = COALESCE(NULLIF($2, ''), display_name),
          nationality = $3,
          intent = $4,
          bio = $5,
          is_profile_complete = ($3 IS NOT NULL AND $4 IS NOT NULL),
          last_active_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [
        user.id,
        body.displayName ?? null,
        body.nationality ?? null,
        body.intent ?? null,
        body.bio ?? null,
      ],
    );
    response.json({ profile: toUserProfile(result.rows[0]) });
  });

  router.get('/v1/topics', async (request, response) => {
    const user = await requireUser(request, response);
    if (!user) return;
    const result = await database.query(
      `
        SELECT
          t.id,
          t.title,
          t.content,
          t.intent,
          t.likes_count,
          t.comments_count,
          t.created_at,
          u.display_name AS author_name,
          u.photo_url AS author_photo,
          u.nationality AS author_nationality
        FROM topics t
        JOIN users u ON u.id = t.author_id
        ORDER BY t.created_at DESC
        LIMIT 50
      `,
    );
    response.json({
      topics: result.rows.map((row) => topicJson(row)),
    });
  });

  router.post('/v1/topics', async (request, response) => {
    const user = await requireUser(request, response);
    if (!user) return;
    const body = request.body as { title?: string; content?: string; intent?: string };
    if (!body.content?.trim()) {
      response.status(400).json({ error: 'CONTENT_REQUIRED' });
      return;
    }
    const id = randomUUID();
    const result = await database.query(
      `
        INSERT INTO topics (id, author_id, title, content, intent)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [id, user.id, body.title ?? '', body.content, body.intent ?? null],
    );
    response.status(201).json({ topic: topicJson(result.rows[0], user) });
  });

  router.post('/v1/topics/:topicId/like', async (request, response) => {
    const user = await requireUser(request, response);
    if (!user) return;
    const { topicId } = request.params;
    await database.query(
      `
        INSERT INTO topic_likes (topic_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `,
      [topicId, user.id],
    );
    const result = await database.query(
      `
        UPDATE topics
        SET likes_count = (
          SELECT count(*)::int FROM topic_likes WHERE topic_id = $1
        )
        WHERE id = $1
        RETURNING likes_count
      `,
      [topicId],
    );
    response.json({ likesCount: result.rows[0]?.likes_count ?? 0 });
  });

  router.get('/v1/topics/:topicId/comments', async (request, response) => {
    const user = await requireUser(request, response);
    if (!user) return;
    const result = await database.query(
      `
        SELECT
          c.id,
          c.text,
          c.created_at,
          u.display_name AS author_name,
          u.photo_url AS author_photo
        FROM comments c
        JOIN users u ON u.id = c.author_id
        WHERE c.topic_id = $1
        ORDER BY c.created_at ASC
      `,
      [request.params.topicId],
    );
    response.json({
      comments: result.rows.map((row) => ({
        id: row.id,
        text: row.text,
        createdAt: dateJson(row.created_at),
        authorName: row.author_name,
        authorPhoto: row.author_photo,
      })),
    });
  });

  router.post('/v1/topics/:topicId/comments', async (request, response) => {
    const user = await requireUser(request, response);
    if (!user) return;
    const body = request.body as { text?: string };
    if (!body.text?.trim()) {
      response.status(400).json({ error: 'TEXT_REQUIRED' });
      return;
    }
    const id = randomUUID();
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        'INSERT INTO comments (id, topic_id, author_id, text) VALUES ($1, $2, $3, $4) RETURNING *',
        [id, request.params.topicId, user.id, body.text],
      );
      await client.query(
        'UPDATE topics SET comments_count = comments_count + 1 WHERE id = $1',
        [request.params.topicId],
      );
      await client.query('COMMIT');
      response.status(201).json({
        comment: {
          id: inserted.rows[0].id,
          text: inserted.rows[0].text,
          createdAt: dateJson(inserted.rows[0].created_at),
          authorName: user.display_name,
          authorPhoto: user.photo_url,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  router.get('/v1/users/discover', async (request, response) => {
    const user = await requireUser(request, response);
    if (!user) return;
    const targetNationality = user.nationality === 'TH' ? 'KR' : 'TH';
    const result = await database.query<AppUserRow>(
      `
        SELECT *
        FROM users
        WHERE id <> $1
          AND ($2::text IS NULL OR nationality = $2)
          AND is_profile_complete = true
        ORDER BY last_active_at DESC NULLS LAST, created_at DESC
        LIMIT 20
      `,
      [user.id, targetNationality],
    );
    response.json({ users: result.rows.map(toUserProfile) });
  });

  router.get('/v1/users/match-candidates', async (request, response) => {
    const user = await requireUser(request, response);
    if (!user) return;
    const nationality = typeof request.query.nationality === 'string' ? request.query.nationality : null;
    const result = await database.query<AppUserRow>(
      `
        SELECT *
        FROM users
        WHERE id <> $1
          AND ($2::text IS NULL OR nationality = $2)
          AND is_profile_complete = true
        ORDER BY last_active_at DESC NULLS LAST, created_at DESC
        LIMIT 5
      `,
      [user.id, nationality],
    );
    response.json({ users: result.rows.map(toUserProfile) });
  });

  router.get('/v1/chats', async (request, response) => {
    const user = await requireUser(request, response);
    if (!user) return;
    const result = await database.query(
      `
        SELECT
          c.id,
          c.last_message,
          c.last_message_at,
          other_user.id AS other_id,
          other_user.display_name AS other_display_name,
          other_user.photo_url AS other_photo_url,
          other_user.nationality AS other_nationality,
          other_user.intent AS other_intent,
          other_user.bio AS other_bio
        FROM chats c
        JOIN chat_participants mine ON mine.chat_id = c.id AND mine.user_id = $1
        JOIN chat_participants other_participant
          ON other_participant.chat_id = c.id AND other_participant.user_id <> $1
        JOIN users other_user ON other_user.id = other_participant.user_id
        ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
      `,
      [user.id],
    );
    response.json({
      chats: result.rows.map((row) => ({
        id: row.id,
        lastMessage: row.last_message,
        lastMessageAt: dateJson(row.last_message_at),
        otherUser: {
          id: row.other_id,
          uid: row.other_id,
          displayName: row.other_display_name,
          photoURL: row.other_photo_url,
          nationality: row.other_nationality,
          intent: row.other_intent,
          bio: row.other_bio,
        },
      })),
    });
  });

  router.post('/v1/chats', async (request, response) => {
    const user = await requireUser(request, response);
    if (!user) return;
    const body = request.body as { targetUserId?: string; userId?: string };
    const targetUserId = body.targetUserId ?? body.userId;
    if (!targetUserId) {
      response.status(400).json({ error: 'TARGET_USER_REQUIRED' });
      return;
    }
    const participants = [user.id, targetUserId].sort();
    const participantKey = participants.join(':');
    let chat = await database.query('SELECT * FROM chats WHERE participant_key = $1 LIMIT 1', [participantKey]);
    if (!chat.rowCount) {
      const id = randomUUID();
      const client = await database.connect();
      try {
        await client.query('BEGIN');
        chat = await client.query(
          `
            INSERT INTO chats (id, participant_key, last_message, last_message_at)
            VALUES ($1, $2, $3, now())
            RETURNING *
          `,
          [id, participantKey, 'Connected. Say hello.'],
        );
        await client.query(
          `
            INSERT INTO chat_participants (chat_id, user_id)
            VALUES ($1, $2), ($1, $3)
          `,
          [id, participants[0], participants[1]],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    response.status(201).json({ chat: chat.rows[0] });
  });

  router.get('/v1/chats/:chatId/messages', async (request, response) => {
    const user = await requireUser(request, response);
    if (!user) return;
    const access = await database.query(
      'SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
      [request.params.chatId, user.id],
    );
    if (!access.rowCount) {
      response.status(404).json({ error: 'CHAT_NOT_FOUND' });
      return;
    }
    const result = await database.query(
      `
        SELECT id, sender_id, text, translations, created_at
        FROM messages
        WHERE chat_id = $1
        ORDER BY created_at ASC
      `,
      [request.params.chatId],
    );
    response.json({
      messages: result.rows.map((row) => ({
        id: row.id,
        senderId: row.sender_id,
        text: row.text,
        translations: row.translations,
        createdAt: dateJson(row.created_at),
      })),
    });
  });

  router.post('/v1/chats/:chatId/messages', async (request, response) => {
    const user = await requireUser(request, response);
    if (!user) return;
    const body = request.body as { text?: string };
    if (!body.text?.trim()) {
      response.status(400).json({ error: 'TEXT_REQUIRED' });
      return;
    }
    const access = await database.query(
      'SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
      [request.params.chatId, user.id],
    );
    if (!access.rowCount) {
      response.status(404).json({ error: 'CHAT_NOT_FOUND' });
      return;
    }
    const id = randomUUID();
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        'INSERT INTO messages (id, chat_id, sender_id, text) VALUES ($1, $2, $3, $4) RETURNING *',
        [id, request.params.chatId, user.id, body.text],
      );
      await client.query(
        'UPDATE chats SET last_message = $2, last_message_at = now() WHERE id = $1',
        [request.params.chatId, body.text],
      );
      await client.query('COMMIT');
      response.status(201).json({
        message: {
          id: inserted.rows[0].id,
          senderId: inserted.rows[0].sender_id,
          text: inserted.rows[0].text,
          translations: inserted.rows[0].translations,
          createdAt: dateJson(inserted.rows[0].created_at),
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  return router;
}
