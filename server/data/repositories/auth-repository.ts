import { appDb, type AppDb } from '../app-db.js';
import type { AppUserRow, ProviderProfile, UserProfileUpdate } from '../schema.js';

export async function touchUserLastActive(userId: string, db: AppDb = appDb): Promise<void> {
  await db.execute('UPDATE users SET last_active_at = now() WHERE id = $1', [userId]);
}

export async function upsertProviderUser(profile: ProviderProfile, db: AppDb = appDb): Promise<AppUserRow> {
  const userId = `${profile.provider}:${profile.providerSubject}`;
  return db.one<AppUserRow>(
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
}

export async function updateUserProfile(
  userId: string,
  body: UserProfileUpdate,
  db: AppDb = appDb,
): Promise<AppUserRow> {
  return db.one<AppUserRow>(
    `
      UPDATE users
      SET
        display_name = COALESCE(NULLIF($2::text, ''), display_name),
        nationality = $3::text,
        intent = $4::text,
        bio = $5::text,
        is_profile_complete = ($3::text IS NOT NULL AND $4::text IS NOT NULL),
        last_active_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [
      userId,
      body.displayName ?? null,
      body.nationality ?? null,
      body.intent ?? null,
      body.bio ?? null,
    ],
  );
}
