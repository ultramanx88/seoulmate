import { randomUUID } from 'node:crypto';
import { database } from '../database.js';
import type { AppUserRow, UserPlan } from './schema.js';

export type FeatureKey =
  | 'posts_daily'
  | 'discover_profiles_daily'
  | 'new_chats_daily'
  | 'ai_translations_daily'
  | 'advanced_filters'
  | 'see_interest'
  | 'private_mode'
  | 'travel_mode'
  | 'profile_review';

export type Entitlement = {
  enabled: boolean;
  limit: number | null;
  period: 'day' | 'month' | null;
};

const freeEntitlements: Record<FeatureKey, Entitlement> = {
  posts_daily: { enabled: true, limit: 3, period: 'day' },
  discover_profiles_daily: { enabled: true, limit: 20, period: 'day' },
  new_chats_daily: { enabled: true, limit: 3, period: 'day' },
  ai_translations_daily: { enabled: true, limit: 10, period: 'day' },
  advanced_filters: { enabled: false, limit: null, period: null },
  see_interest: { enabled: false, limit: null, period: null },
  private_mode: { enabled: false, limit: null, period: null },
  travel_mode: { enabled: false, limit: null, period: null },
  profile_review: { enabled: false, limit: null, period: null },
};

const proEntitlements: Record<FeatureKey, Entitlement> = {
  posts_daily: { enabled: true, limit: 20, period: 'day' },
  discover_profiles_daily: { enabled: true, limit: null, period: 'day' },
  new_chats_daily: { enabled: true, limit: 20, period: 'day' },
  ai_translations_daily: { enabled: true, limit: 300, period: 'month' },
  advanced_filters: { enabled: true, limit: null, period: null },
  see_interest: { enabled: true, limit: null, period: null },
  private_mode: { enabled: true, limit: null, period: null },
  travel_mode: { enabled: true, limit: null, period: null },
  profile_review: { enabled: true, limit: 1, period: 'month' },
};

export function entitlementsForPlan(plan: UserPlan): Record<FeatureKey, Entitlement> {
  return plan === 'pro' ? proEntitlements : freeEntitlements;
}

export function getEntitlement(user: AppUserRow, featureKey: FeatureKey): Entitlement {
  return entitlementsForPlan(user.plan)[featureKey];
}

export function periodKey(period: 'day' | 'month', now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  if (period === 'month') return `${year}-${month}`;
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function resetAt(period: 'day' | 'month', now = new Date()): Date {
  if (period === 'month') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

export async function getUsage(userId: string, featureKey: FeatureKey, period: 'day' | 'month') {
  const result = await database.query<{ used_count: number; limit_count: number | null; reset_at: Date }>(
    `
      SELECT used_count, limit_count, reset_at
      FROM usage_counters
      WHERE user_id = $1 AND feature_key = $2 AND period_key = $3
      LIMIT 1
    `,
    [userId, featureKey, periodKey(period)],
  );
  return result.rows[0] ?? { used_count: 0, limit_count: null, reset_at: resetAt(period) };
}

export async function consumeUsage(user: AppUserRow, featureKey: FeatureKey, amount = 1): Promise<void> {
  const entitlement = getEntitlement(user, featureKey);
  if (!entitlement.enabled) {
    const error = new Error('FEATURE_REQUIRES_PRO');
    (error as Error & { status?: number }).status = 402;
    throw error;
  }
  if (!entitlement.period) return;

  const key = periodKey(entitlement.period);
  const reset = resetAt(entitlement.period);
  const result = await database.query<{ used_count: number; limit_count: number | null }>(
    `
      INSERT INTO usage_counters (user_id, feature_key, period_key, used_count, limit_count, reset_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, feature_key, period_key)
      DO UPDATE SET used_count = usage_counters.used_count + EXCLUDED.used_count,
                    limit_count = EXCLUDED.limit_count,
                    reset_at = EXCLUDED.reset_at
      RETURNING used_count, limit_count
    `,
    [user.id, featureKey, key, amount, entitlement.limit, reset],
  );

  const usage = result.rows[0];
  if (usage.limit_count !== null && usage.used_count > usage.limit_count) {
    await database.query(
      `
        UPDATE usage_counters
        SET used_count = GREATEST(0, used_count - $4)
        WHERE user_id = $1 AND feature_key = $2 AND period_key = $3
      `,
      [user.id, featureKey, key, amount],
    );
    const error = new Error('USAGE_LIMIT_REACHED');
    (error as Error & { status?: number }).status = 402;
    throw error;
  }
}

export async function setUserPlan(
  userId: string,
  plan: UserPlan,
  options: { adminId?: string; reason?: string; months?: number } = {},
): Promise<void> {
  await database.query('UPDATE users SET plan = $2 WHERE id = $1', [userId, plan]);
  if (plan !== 'pro') {
    await database.query(
      `
        UPDATE subscriptions
        SET status = 'canceled'
        WHERE user_id = $1 AND provider = 'manual' AND status IN ('trialing', 'active', 'past_due')
      `,
      [userId],
    );
    await database.query(
      `
        INSERT INTO subscription_events (id, user_id, provider, event_type, payload)
        VALUES ($1, $2, 'manual', 'admin_plan_removed', $3)
      `,
      [
        randomUUID(),
        userId,
        {
          adminId: options.adminId ?? null,
          reason: options.reason ?? null,
        },
      ],
    );
    return;
  }

  const subscriptionId = randomUUID();
  const periodEnd = new Date();
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + (options.months ?? 1));
  await database.query(
    `
      INSERT INTO subscriptions (
        id, user_id, plan, status, provider, current_period_start, current_period_end
      )
      VALUES ($1, $2, 'pro', 'active', 'manual', now(), $3)
    `,
    [subscriptionId, userId, periodEnd],
  );
  await database.query(
    `
      INSERT INTO subscription_events (id, subscription_id, user_id, provider, event_type, payload)
      VALUES ($1, $2, $3, 'manual', 'admin_plan_granted', $4)
    `,
    [
      randomUUID(),
      subscriptionId,
      userId,
      {
        adminId: options.adminId ?? null,
        reason: options.reason ?? null,
        months: options.months ?? 1,
      },
    ],
  );
}
