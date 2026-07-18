ALTER TABLE users
  ADD COLUMN safety_status text NOT NULL DEFAULT 'active'
    CHECK (safety_status IN ('active', 'suspended', 'banned', 'deleted'));

CREATE INDEX users_safety_status_idx ON users (safety_status);

ALTER TABLE topics
  ADD COLUMN moderation_status text NOT NULL DEFAULT 'visible'
    CHECK (moderation_status IN ('visible', 'hidden', 'removed'));

ALTER TABLE comments
  ADD COLUMN moderation_status text NOT NULL DEFAULT 'visible'
    CHECK (moderation_status IN ('visible', 'hidden', 'removed'));

ALTER TABLE messages
  ADD COLUMN moderation_status text NOT NULL DEFAULT 'visible'
    CHECK (moderation_status IN ('visible', 'hidden', 'removed'));

CREATE INDEX topics_moderation_status_idx ON topics (moderation_status, created_at DESC);
CREATE INDEX comments_moderation_status_idx ON comments (moderation_status, created_at);
CREATE INDEX messages_moderation_status_idx ON messages (moderation_status, created_at);

CREATE TABLE admin_users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'moderator'
    CHECK (role IN ('superadmin', 'admin', 'moderator')),
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE admin_sessions (
  id text PRIMARY KEY,
  admin_id text NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  user_agent text,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE INDEX admin_sessions_active_idx
  ON admin_sessions (id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE user_blocks (
  blocker_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_user_id),
  CHECK (blocker_id <> blocked_user_id)
);

CREATE INDEX user_blocks_blocked_user_id_idx ON user_blocks (blocked_user_id);

CREATE TABLE reports (
  id text PRIMARY KEY,
  reporter_id text REFERENCES users(id) ON DELETE SET NULL,
  reported_user_id text REFERENCES users(id) ON DELETE SET NULL,
  topic_id text REFERENCES topics(id) ON DELETE SET NULL,
  comment_id text REFERENCES comments(id) ON DELETE SET NULL,
  message_id text REFERENCES messages(id) ON DELETE SET NULL,
  reason text NOT NULL,
  detail text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  priority integer NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 4),
  assigned_admin_id text REFERENCES admin_users(id) ON DELETE SET NULL,
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX reports_status_created_at_idx ON reports (status, created_at DESC);
CREATE INDEX reports_reporter_id_idx ON reports (reporter_id, created_at DESC);
CREATE INDEX reports_reported_user_id_idx ON reports (reported_user_id, created_at DESC);

CREATE TABLE moderation_actions (
  id text PRIMARY KEY,
  admin_id text REFERENCES admin_users(id) ON DELETE SET NULL,
  report_id text REFERENCES reports(id) ON DELETE SET NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  action text NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX moderation_actions_target_idx ON moderation_actions (target_type, target_id, created_at DESC);
CREATE INDEX moderation_actions_admin_id_idx ON moderation_actions (admin_id, created_at DESC);

CREATE TRIGGER admin_users_set_updated_at
BEFORE UPDATE ON admin_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER reports_set_updated_at
BEFORE UPDATE ON reports
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
