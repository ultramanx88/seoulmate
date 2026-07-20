ALTER TABLE users
  ADD COLUMN plan text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'pro'));

CREATE INDEX users_plan_idx ON users (plan);

CREATE TABLE subscriptions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('pro')),
  status text NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  provider text NOT NULL DEFAULT 'manual'
    CHECK (provider IN ('manual', 'stripe')),
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX subscriptions_provider_subscription_idx
  ON subscriptions (provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;
CREATE INDEX subscriptions_user_status_idx ON subscriptions (user_id, status, current_period_end DESC);

CREATE TABLE subscription_events (
  id text PRIMARY KEY,
  subscription_id text REFERENCES subscriptions(id) ON DELETE SET NULL,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'manual',
  event_type text NOT NULL,
  provider_event_id text,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX subscription_events_provider_event_idx
  ON subscription_events (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE TABLE usage_counters (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  period_key text NOT NULL,
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  limit_count integer CHECK (limit_count IS NULL OR limit_count >= 0),
  reset_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, feature_key, period_key)
);

CREATE INDEX usage_counters_reset_at_idx ON usage_counters (reset_at);

CREATE TRIGGER subscriptions_set_updated_at
BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER usage_counters_set_updated_at
BEFORE UPDATE ON usage_counters
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
