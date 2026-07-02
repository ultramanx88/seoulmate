CREATE TABLE auth_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE INDEX auth_sessions_user_id_idx ON auth_sessions (user_id, created_at DESC);
CREATE INDEX auth_sessions_active_idx
  ON auth_sessions (id, expires_at)
  WHERE revoked_at IS NULL;
