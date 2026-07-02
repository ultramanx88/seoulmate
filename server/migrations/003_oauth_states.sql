CREATE TABLE oauth_states (
  state text PRIMARY KEY,
  provider text NOT NULL,
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE INDEX oauth_states_active_idx
  ON oauth_states (provider, state, expires_at)
  WHERE consumed_at IS NULL;
