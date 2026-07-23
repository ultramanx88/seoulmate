import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { verifyToken } from '@clerk/backend';
import type { Request, Response, Router } from 'express';
import express from 'express';
import { config } from './config.js';
import { database } from './database.js';
import {
  touchUserLastActive,
  updateUserProfile,
  upsertProviderUser,
} from './data/repositories/auth-repository.js';
import {
  consumeUsage,
  entitlementsForPlan,
  getUsage,
  type FeatureKey,
  setUserPlan,
  type Entitlement,
} from './data/entitlements.js';
import {
  type AppUserRow,
  type ProviderProfile,
  type UserProfileUpdate,
  toUserProfile,
} from './data/schema.js';

const adminSessionCookieName = 'seoulmate_admin_session';
const adminSessionTtlSeconds = 60 * 60 * 12;
const scrypt = promisify(scryptCallback);

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

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url');
  const key = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${key.toString('base64url')}`;
}

async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [scheme, salt, expected] = passwordHash.split('$');
  if (scheme !== 'scrypt' || !salt || !expected) return false;
  const actual = await scrypt(password, salt, 64) as Buffer;
  const expectedBuffer = Buffer.from(expected, 'base64url');
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

async function ensureSuperadminSeeded(): Promise<void> {
  const email = config.ADMIN_SUPER_EMAIL.trim().toLowerCase();
  const password = config.ADMIN_SUPER_PASSWORD;
  if (!email || !password) return;

  const existing = await database.query<{ id: string; password_hash: string }>(
    'SELECT id, password_hash FROM admin_users WHERE email = $1 LIMIT 1',
    [email],
  );
  const passwordHash = await hashPassword(password);
  if (!existing.rowCount) {
    await database.query(
      `
        INSERT INTO admin_users (id, email, password_hash, role, display_name)
        VALUES ($1, $2, $3, 'superadmin', $4)
      `,
      [randomUUID(), email, passwordHash, 'Superadmin'],
    );
    return;
  }

  const currentPasswordWorks = await verifyPassword(password, existing.rows[0].password_hash);
  await database.query(
    `
      UPDATE admin_users
      SET role = 'superadmin',
          password_hash = CASE WHEN $3 THEN password_hash ELSE $2 END
      WHERE id = $1
    `,
    [existing.rows[0].id, passwordHash, currentPasswordWorks],
  );
}

async function getCurrentUser(request: Request): Promise<AppUserRow | null> {
  const token = bearerToken(request) ?? parseCookies(request.headers.cookie).__session;
  if (!token) return null;
  if (!config.CLERK_SECRET_KEY && !config.CLERK_JWT_KEY) return null;
  try {
    const claims = await verifyToken(token, {
      secretKey: config.CLERK_SECRET_KEY || undefined,
      jwtKey: config.CLERK_JWT_KEY || undefined,
      authorizedParties: config.clerkAuthorizedParties.length ? config.clerkAuthorizedParties : undefined,
    });
    if (!claims.sub) return null;
    const clerkProfile: ProviderProfile = {
      provider: 'clerk',
      providerSubject: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : null,
      emailVerified: Boolean(claims.email_verified),
      displayName: typeof claims.name === 'string' ? claims.name : 'Seoulmate user',
      photoUrl: typeof claims.picture === 'string' ? claims.picture : null,
    };
    const user = await upsertProviderUser(clerkProfile);
    void touchUserLastActive(user.id);
    return user;
  } catch (error) {
    console.warn('Clerk token verification failed', error instanceof Error ? error.message : error);
    return null;
  }
}

async function requireUser(request: Request, response: Response): Promise<AppUserRow | null> {
  const user = await getCurrentUser(request);
  if (!user) {
    response.status(401).json({ error: 'UNAUTHENTICATED' });
    return null;
  }
  if (user.safety_status && user.safety_status !== 'active') {
    response.status(403).json({ error: 'ACCOUNT_RESTRICTED', status: user.safety_status });
    return null;
  }
  return user;
}

function bearerToken(request: Request): string | null {
  const header = request.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

type AdminRow = {
  id: string;
  email: string;
  role: 'superadmin' | 'admin' | 'moderator';
  display_name: string;
};

function adminJson(admin: AdminRow) {
  return {
    id: admin.id,
    email: admin.email,
    role: admin.role,
    displayName: admin.display_name,
  };
}

async function getCurrentAdmin(request: Request): Promise<AdminRow | null> {
  const token = parseCookies(request.headers.cookie)[adminSessionCookieName];
  if (!token) return null;
  const result = await database.query<AdminRow>(
    `
      SELECT a.id, a.email, a.role, a.display_name
      FROM admin_sessions s
      JOIN admin_users a ON a.id = s.admin_id
      WHERE s.id = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
      LIMIT 1
    `,
    [token],
  );
  return result.rows[0] ?? null;
}

async function requireAdmin(request: Request, response: Response): Promise<AdminRow | null> {
  const admin = await getCurrentAdmin(request);
  if (!admin) {
    response.status(401).json({ error: 'ADMIN_UNAUTHENTICATED' });
    return null;
  }
  return admin;
}

async function createAdminSession(request: Request, response: Response, adminId: string): Promise<void> {
  const sessionId = randomUUID();
  await database.query(
    `
      INSERT INTO admin_sessions (id, admin_id, user_agent, ip_address, expires_at)
      VALUES ($1, $2, $3, NULLIF($4, '')::inet, now() + ($5::text || ' seconds')::interval)
    `,
    [sessionId, adminId, request.get('user-agent') ?? null, request.ip ?? '', adminSessionTtlSeconds],
  );
  response.setHeader(
    'Set-Cookie',
    serializeCookie(adminSessionCookieName, sessionId, { maxAge: adminSessionTtlSeconds }),
  );
}

async function hasBlockBetween(userId: string, otherUserId: string): Promise<boolean> {
  const result = await database.query(
    `
      SELECT 1
      FROM user_blocks
      WHERE (blocker_id = $1 AND blocked_user_id = $2)
         OR (blocker_id = $2 AND blocked_user_id = $1)
      LIMIT 1
    `,
    [userId, otherUserId],
  );
  return Boolean(result.rowCount);
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
    authorId: row.author_id ?? author?.id,
    authorName: row.author_name ?? author?.display_name,
    authorPhoto: row.author_photo ?? author?.photo_url,
    authorNationality: row.author_nationality ?? author?.nationality,
  };
}

async function entitlementJson(user: AppUserRow) {
  const entitlements = entitlementsForPlan(user.plan);
  const entries = await Promise.all(
    Object.entries(entitlements).map(async ([featureKey, entitlement]) => {
      if (!entitlement.period) {
        return [featureKey, { ...entitlement, used: null, remaining: null, resetAt: null }];
      }
      const usage = await getUsage(user.id, featureKey as FeatureKey, entitlement.period);
      const used = usage.used_count ?? 0;
      return [
        featureKey,
        {
          ...entitlement,
          used,
          remaining: entitlement.limit === null ? null : Math.max(0, entitlement.limit - used),
          resetAt: usage.reset_at.toISOString(),
        },
      ];
    }),
  );
  return {
    plan: user.plan,
    entitlements: Object.fromEntries(entries) as Record<FeatureKey, Entitlement & {
      used: number | null;
      remaining: number | null;
      resetAt: string | null;
    }>,
  };
}

async function tryConsumeUsage(response: Response, user: AppUserRow, featureKey: FeatureKey): Promise<boolean> {
  try {
    await consumeUsage(user, featureKey);
    return true;
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    response.status(status).json({
      error: error instanceof Error ? error.message : 'ENTITLEMENT_ERROR',
      feature: featureKey,
      plan: user.plan,
    });
    return false;
  }
}

export function createApiRouter(): Router {
  const router = express.Router();

  router.post('/v1/admin/auth/login', async (request, response) => {
    await ensureSuperadminSeeded();
    const body = request.body as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase() ?? '';
    const password = body.password ?? '';
    if (!email || !password) {
      response.status(400).json({ error: 'ADMIN_CREDENTIALS_REQUIRED' });
      return;
    }

    const result = await database.query<AdminRow & { password_hash: string }>(
      'SELECT id, email, password_hash, role, display_name FROM admin_users WHERE email = $1 LIMIT 1',
      [email],
    );
    const admin = result.rows[0];
    if (!admin || !(await verifyPassword(password, admin.password_hash))) {
      response.status(401).json({ error: 'INVALID_ADMIN_CREDENTIALS' });
      return;
    }

    await createAdminSession(request, response, admin.id);
    await database.query('UPDATE admin_users SET last_login_at = now() WHERE id = $1', [admin.id]);
    response.json({ admin: adminJson(admin) });
  });

  router.get('/v1/admin/auth/me', async (request, response) => {
    await ensureSuperadminSeeded();
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    response.json({ admin: adminJson(admin) });
  });

  router.post('/v1/admin/auth/logout', async (request, response) => {
    const token = parseCookies(request.headers.cookie)[adminSessionCookieName];
    if (token) {
      await database.query('UPDATE admin_sessions SET revoked_at = now() WHERE id = $1', [token]);
    }
    response.setHeader('Set-Cookie', serializeCookie(adminSessionCookieName, '', { maxAge: 1 }));
    response.json({ ok: true });
  });

  router.get('/v1/admin/overview', async (request, response) => {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    const [users, reports, content, messages] = await Promise.all([
      database.query(`
        SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE safety_status = 'active')::int AS active,
          count(*) FILTER (WHERE safety_status = 'suspended')::int AS suspended,
          count(*) FILTER (WHERE safety_status = 'banned')::int AS banned
        FROM users
      `),
      database.query(`
        SELECT
          count(*) FILTER (WHERE status = 'open')::int AS open,
          count(*) FILTER (WHERE status = 'reviewing')::int AS reviewing,
          count(*) FILTER (WHERE status = 'resolved')::int AS resolved
        FROM reports
      `),
      database.query(`
        SELECT
          (SELECT count(*)::int FROM topics WHERE moderation_status = 'visible') AS topics,
          (SELECT count(*)::int FROM comments WHERE moderation_status = 'visible') AS comments
      `),
      database.query('SELECT count(*)::int AS messages FROM messages WHERE moderation_status = $1', ['visible']),
    ]);
    response.json({
      users: users.rows[0],
      reports: reports.rows[0],
      content: { ...content.rows[0], messages: messages.rows[0]?.messages ?? 0 },
    });
  });

  router.get('/v1/admin/reports', async (request, response) => {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    const status = typeof request.query.status === 'string' ? request.query.status : null;
    const result = await database.query(
      `
        SELECT
          r.*,
          reporter.display_name AS reporter_name,
          reported.display_name AS reported_name
        FROM reports r
        LEFT JOIN users reporter ON reporter.id = r.reporter_id
        LEFT JOIN users reported ON reported.id = r.reported_user_id
        WHERE ($1::text IS NULL OR r.status = $1)
        ORDER BY r.created_at DESC
        LIMIT 100
      `,
      [status],
    );
    response.json({
      reports: result.rows.map((row) => ({
        id: row.id,
        status: row.status,
        priority: row.priority,
        reason: row.reason,
        detail: row.detail,
        reporterId: row.reporter_id,
        reporterName: row.reporter_name,
        reportedUserId: row.reported_user_id,
        reportedName: row.reported_name,
        topicId: row.topic_id,
        commentId: row.comment_id,
        messageId: row.message_id,
        resolution: row.resolution,
        createdAt: dateJson(row.created_at),
        resolvedAt: dateJson(row.resolved_at),
      })),
    });
  });

  router.patch('/v1/admin/reports/:reportId', async (request, response) => {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    const body = request.body as { status?: string; resolution?: string };
    const allowed = new Set(['open', 'reviewing', 'resolved', 'dismissed']);
    if (!body.status || !allowed.has(body.status)) {
      response.status(400).json({ error: 'INVALID_REPORT_STATUS' });
      return;
    }
    const result = await database.query(
      `
        UPDATE reports
        SET status = $2,
            resolution = $3,
            assigned_admin_id = $4,
            resolved_at = CASE WHEN $2 IN ('resolved', 'dismissed') THEN now() ELSE resolved_at END
        WHERE id = $1
        RETURNING *
      `,
      [request.params.reportId, body.status, body.resolution ?? null, admin.id],
    );
    if (!result.rowCount) {
      response.status(404).json({ error: 'REPORT_NOT_FOUND' });
      return;
    }
    await database.query(
      `
        INSERT INTO moderation_actions (id, admin_id, report_id, target_type, target_id, action, reason)
        VALUES ($1, $2, $3, 'report', $3, 'report_status_changed', $4)
      `,
      [randomUUID(), admin.id, request.params.reportId, body.resolution ?? body.status],
    );
    response.json({ report: result.rows[0] });
  });

  router.get('/v1/admin/users', async (request, response) => {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    const result = await database.query<AppUserRow & { reports_count: number }>(
      `
        SELECT u.*, count(r.id)::int AS reports_count
        FROM users u
        LEFT JOIN reports r ON r.reported_user_id = u.id AND r.status IN ('open', 'reviewing')
        GROUP BY u.id
        ORDER BY reports_count DESC, u.created_at DESC
        LIMIT 100
      `,
    );
    response.json({
      users: result.rows.map((row) => ({ ...toUserProfile(row), reportsCount: row.reports_count })),
    });
  });

  router.patch('/v1/admin/users/:userId/status', async (request, response) => {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    const body = request.body as { status?: string; reason?: string };
    const allowed = new Set(['active', 'suspended', 'banned', 'deleted']);
    if (!body.status || !allowed.has(body.status)) {
      response.status(400).json({ error: 'INVALID_USER_STATUS' });
      return;
    }
    const result = await database.query<AppUserRow>(
      'UPDATE users SET safety_status = $2 WHERE id = $1 RETURNING *',
      [request.params.userId, body.status],
    );
    if (!result.rowCount) {
      response.status(404).json({ error: 'USER_NOT_FOUND' });
      return;
    }
    await database.query(
      `
        INSERT INTO moderation_actions (id, admin_id, target_type, target_id, action, reason)
        VALUES ($1, $2, 'user', $3, $4, $5)
      `,
      [randomUUID(), admin.id, request.params.userId, `user_${body.status}`, body.reason ?? null],
    );
    response.json({ user: toUserProfile(result.rows[0]) });
  });

  router.patch('/v1/admin/users/:userId/plan', async (request, response) => {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    const body = request.body as { plan?: string; reason?: string; months?: number };
    if (body.plan !== 'free' && body.plan !== 'pro') {
      response.status(400).json({ error: 'INVALID_USER_PLAN' });
      return;
    }
    const user = await database.query<AppUserRow>('SELECT * FROM users WHERE id = $1 LIMIT 1', [request.params.userId]);
    if (!user.rowCount) {
      response.status(404).json({ error: 'USER_NOT_FOUND' });
      return;
    }
    await setUserPlan(request.params.userId, body.plan, {
      adminId: admin.id,
      reason: body.reason,
      months: body.months ?? 1,
    });
    await database.query(
      `
        INSERT INTO moderation_actions (id, admin_id, target_type, target_id, action, reason, metadata)
        VALUES ($1, $2, 'user', $3, $4, $5, $6)
      `,
      [
        randomUUID(),
        admin.id,
        request.params.userId,
        `plan_${body.plan}`,
        body.reason ?? null,
        { months: body.months ?? 1 },
      ],
    );
    const updated = await database.query<AppUserRow>('SELECT * FROM users WHERE id = $1 LIMIT 1', [request.params.userId]);
    response.json({ user: toUserProfile(updated.rows[0]) });
  });

  router.get('/v1/auth/me', async (request, response) => {
    const user = await getCurrentUser(request);
    if (!user) {
      response.status(401).json({ error: 'UNAUTHENTICATED' });
      return;
    }
    response.json({ user: toUserProfile(user), profile: toUserProfile(user) });
  });

  router.put('/v1/me/profile', async (request, response) => {
    const user = await requireUser(request, response);
    if (!user) return;
    const body = request.body as UserProfileUpdate;
    const updated = await updateUserProfile(user.id, body);
    response.json({ profile: toUserProfile(updated) });
  });

  router.get('/v1/me/entitlements', async (request, response) => {
    const user = await requireUser(request, response);
    if (!user) return;
    response.json(await entitlementJson(user));
  });

  router.post('/v1/me/usage/:featureKey/consume', async (request, response) => {
    const user = await requireUser(request, response);
    if (!user) return;
    const featureKey = request.params.featureKey as FeatureKey;
    const allowed: FeatureKey[] = ['ai_translations_daily', 'profile_review'];
    if (!allowed.includes(featureKey)) {
      response.status(400).json({ error: 'FEATURE_USAGE_NOT_CONSUMABLE' });
      return;
    }
    if (!await tryConsumeUsage(response, user, featureKey)) return;
    response.json(await entitlementJson(user));
  });

  router.post('/v1/reports', async (request, response) => {
    const user = await requireUser(request, response);
    if (!user) return;
    const body = request.body as {
      targetType?: 'user' | 'topic' | 'comment' | 'message';
      targetId?: string;
      reason?: string;
      detail?: string;
      reportedUserId?: string;
    };
    if (!body.targetType || !body.targetId || !body.reason?.trim()) {
      response.status(400).json({ error: 'REPORT_TARGET_AND_REASON_REQUIRED' });
      return;
    }
    const id = randomUUID();
    await database.query(
      `
        INSERT INTO reports (
          id, reporter_id, reported_user_id, topic_id, comment_id, message_id, reason, detail
        )
        VALUES (
          $1, $2,
          CASE WHEN $3 = 'user' THEN $4 ELSE $7 END,
          CASE WHEN $3 = 'topic' THEN $4 ELSE NULL END,
          CASE WHEN $3 = 'comment' THEN $4 ELSE NULL END,
          CASE WHEN $3 = 'message' THEN $4 ELSE NULL END,
          $5, $6
        )
      `,
      [
        id,
        user.id,
        body.targetType,
        body.targetId,
        body.reason.trim(),
        body.detail?.trim() || null,
        body.reportedUserId ?? null,
      ],
    );
    response.status(201).json({ report: { id, status: 'open' } });
  });

  router.post('/v1/users/:userId/block', async (request, response) => {
    const user = await requireUser(request, response);
    if (!user) return;
    if (request.params.userId === user.id) {
      response.status(400).json({ error: 'CANNOT_BLOCK_SELF' });
      return;
    }
    const body = request.body as { reason?: string };
    await database.query(
      `
        INSERT INTO user_blocks (blocker_id, blocked_user_id, reason)
        VALUES ($1, $2, $3)
        ON CONFLICT (blocker_id, blocked_user_id)
        DO UPDATE SET reason = EXCLUDED.reason
      `,
      [user.id, request.params.userId, body.reason ?? null],
    );
    response.json({ ok: true });
  });

  router.delete('/v1/users/:userId/block', async (request, response) => {
    const user = await requireUser(request, response);
    if (!user) return;
    await database.query(
      'DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_user_id = $2',
      [user.id, request.params.userId],
    );
    response.json({ ok: true });
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
          t.author_id,
          u.display_name AS author_name,
          u.photo_url AS author_photo,
          u.nationality AS author_nationality
        FROM topics t
        JOIN users u ON u.id = t.author_id
        WHERE t.moderation_status = 'visible'
          AND u.safety_status = 'active'
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
    if (!await tryConsumeUsage(response, user, 'posts_daily')) return;
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
    const topic = await database.query(
      `
        SELECT id, comments_count
        FROM topics
        WHERE id = $1
          AND moderation_status = 'visible'
        LIMIT 1
      `,
      [request.params.topicId],
    );
    if (!topic.rowCount) {
      response.status(404).json({ error: 'TOPIC_NOT_FOUND' });
      return;
    }
    const result = await database.query(
      `
        SELECT
          c.id,
          c.author_id,
          c.text,
          c.created_at,
          u.display_name AS author_name,
          u.photo_url AS author_photo,
          u.nationality AS author_nationality
        FROM comments c
        JOIN users u ON u.id = c.author_id
        WHERE c.topic_id = $1
          AND c.moderation_status = 'visible'
          AND u.safety_status = 'active'
        ORDER BY c.created_at ASC
      `,
      [request.params.topicId],
    );
    response.json({
      comments: result.rows.map((row) => ({
        id: row.id,
        authorId: row.author_id,
        text: row.text,
        createdAt: dateJson(row.created_at),
        authorName: row.author_name,
        authorPhoto: row.author_photo,
        authorNationality: row.author_nationality,
      })),
      commentsCount: topic.rows[0]?.comments_count ?? result.rowCount,
    });
  });

  router.post('/v1/topics/:topicId/comments', async (request, response) => {
    const user = await requireUser(request, response);
    if (!user) return;
    const body = request.body as { text?: string };
    const text = body.text?.trim() ?? '';
    if (!text) {
      response.status(400).json({ error: 'TEXT_REQUIRED' });
      return;
    }
    if (text.length > 2000) {
      response.status(400).json({ error: 'TEXT_TOO_LONG' });
      return;
    }
    const id = randomUUID();
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      const topic = await client.query(
        `
          SELECT id
          FROM topics
          WHERE id = $1
            AND moderation_status = 'visible'
          FOR UPDATE
        `,
        [request.params.topicId],
      );
      if (!topic.rowCount) {
        await client.query('ROLLBACK');
        response.status(404).json({ error: 'TOPIC_NOT_FOUND' });
        return;
      }
      const inserted = await client.query(
        'INSERT INTO comments (id, topic_id, author_id, text) VALUES ($1, $2, $3, $4) RETURNING *',
        [id, request.params.topicId, user.id, text],
      );
      const topicUpdate = await client.query(
        'UPDATE topics SET comments_count = comments_count + 1 WHERE id = $1 RETURNING comments_count',
        [request.params.topicId],
      );
      await client.query('COMMIT');
      response.status(201).json({
        comment: {
          id: inserted.rows[0].id,
          authorId: user.id,
          text: inserted.rows[0].text,
          createdAt: dateJson(inserted.rows[0].created_at),
          authorName: user.display_name,
          authorPhoto: user.photo_url,
          authorNationality: user.nationality,
        },
        commentsCount: topicUpdate.rows[0]?.comments_count ?? null,
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
    if (!await tryConsumeUsage(response, user, 'discover_profiles_daily')) return;
    const targetNationality = user.nationality === 'TH' ? 'KR' : 'TH';
    const result = await database.query<AppUserRow>(
      `
        SELECT *
        FROM users
        WHERE id <> $1
          AND ($2::text IS NULL OR nationality = $2)
          AND safety_status = 'active'
          AND is_profile_complete = true
          AND NOT EXISTS (
            SELECT 1 FROM user_blocks b
            WHERE (b.blocker_id = $1 AND b.blocked_user_id = users.id)
               OR (b.blocker_id = users.id AND b.blocked_user_id = $1)
          )
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
    if (!await tryConsumeUsage(response, user, 'discover_profiles_daily')) return;
    const nationality = typeof request.query.nationality === 'string' ? request.query.nationality : null;
    const result = await database.query<AppUserRow>(
      `
        SELECT *
        FROM users
        WHERE id <> $1
          AND ($2::text IS NULL OR nationality = $2)
          AND safety_status = 'active'
          AND is_profile_complete = true
          AND NOT EXISTS (
            SELECT 1 FROM user_blocks b
            WHERE (b.blocker_id = $1 AND b.blocked_user_id = users.id)
               OR (b.blocker_id = users.id AND b.blocked_user_id = $1)
          )
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
        WHERE other_user.safety_status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM user_blocks b
            WHERE (b.blocker_id = $1 AND b.blocked_user_id = other_user.id)
               OR (b.blocker_id = other_user.id AND b.blocked_user_id = $1)
          )
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
    const target = await database.query<AppUserRow>(
      'SELECT * FROM users WHERE id = $1 AND safety_status = $2 LIMIT 1',
      [targetUserId, 'active'],
    );
    if (!target.rowCount) {
      response.status(404).json({ error: 'TARGET_USER_NOT_FOUND' });
      return;
    }
    if (await hasBlockBetween(user.id, targetUserId)) {
      response.status(403).json({ error: 'USER_BLOCKED' });
      return;
    }
    const participants = [user.id, targetUserId].sort();
    const participantKey = participants.join(':');
    let chat = await database.query('SELECT * FROM chats WHERE participant_key = $1 LIMIT 1', [participantKey]);
    if (!chat.rowCount) {
      if (!await tryConsumeUsage(response, user, 'new_chats_daily')) return;
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
    const otherParticipant = await database.query<{ user_id: string }>(
      'SELECT user_id FROM chat_participants WHERE chat_id = $1 AND user_id <> $2 LIMIT 1',
      [request.params.chatId, user.id],
    );
    if (otherParticipant.rows[0] && await hasBlockBetween(user.id, otherParticipant.rows[0].user_id)) {
      response.status(403).json({ error: 'USER_BLOCKED' });
      return;
    }
    const result = await database.query(
      `
        SELECT id, sender_id, text, translations, created_at
        FROM messages
        WHERE chat_id = $1
          AND moderation_status = 'visible'
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
    const otherParticipant = await database.query<{ user_id: string }>(
      'SELECT user_id FROM chat_participants WHERE chat_id = $1 AND user_id <> $2 LIMIT 1',
      [request.params.chatId, user.id],
    );
    if (otherParticipant.rows[0] && await hasBlockBetween(user.id, otherParticipant.rows[0].user_id)) {
      response.status(403).json({ error: 'USER_BLOCKED' });
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
