CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE users (
  id text PRIMARY KEY,
  firebase_uid text UNIQUE,
  auth_provider text NOT NULL DEFAULT 'firebase',
  provider_subject text,
  email text,
  email_verified boolean NOT NULL DEFAULT false,
  display_name text NOT NULL,
  photo_url text,
  nationality text CHECK (nationality IN ('TH', 'KR')),
  intent text CHECK (intent IN ('dating', 'friendship', 'exchange')),
  interests text[] NOT NULL DEFAULT '{}',
  languages text[] NOT NULL DEFAULT '{}',
  bio text,
  location jsonb,
  is_profile_complete boolean NOT NULL DEFAULT false,
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_provider_identity_idx
  ON users (auth_provider, provider_subject)
  WHERE provider_subject IS NOT NULL;
CREATE INDEX users_nationality_idx ON users (nationality);
CREATE INDEX users_last_active_at_idx ON users (last_active_at DESC);

CREATE TABLE topics (
  id text PRIMARY KEY,
  author_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  content text NOT NULL,
  intent text,
  tags text[] NOT NULL DEFAULT '{}',
  location jsonb,
  likes_count integer NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  comments_count integer NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX topics_created_at_idx ON topics (created_at DESC);
CREATE INDEX topics_author_id_idx ON topics (author_id, created_at DESC);
CREATE INDEX topics_intent_idx ON topics (intent);
CREATE INDEX topics_tags_idx ON topics USING gin (tags);

CREATE TABLE topic_likes (
  topic_id text NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (topic_id, user_id)
);

CREATE TABLE comments (
  id text PRIMARY KEY,
  topic_id text NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  author_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX comments_topic_id_idx ON comments (topic_id, created_at);

CREATE TABLE chats (
  id text PRIMARY KEY,
  participant_key text NOT NULL,
  last_message text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chats_last_message_at_idx ON chats (last_message_at DESC);
CREATE INDEX chats_participant_key_idx ON chats (participant_key);

CREATE TABLE chat_participants (
  chat_id text NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,
  PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX chat_participants_user_id_idx
  ON chat_participants (user_id, chat_id);

CREATE TABLE messages (
  id text PRIMARY KEY,
  chat_id text NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text text NOT NULL,
  translations jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_chat_id_idx ON messages (chat_id, created_at);

CREATE TABLE precomputed_feeds (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  topics jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE firebase_migration_records (
  collection_name text NOT NULL,
  firebase_document_id text NOT NULL,
  postgres_table text NOT NULL,
  postgres_id text NOT NULL,
  source_updated_at timestamptz,
  migrated_at timestamptz NOT NULL DEFAULT now(),
  source_hash text,
  PRIMARY KEY (collection_name, firebase_document_id)
);

CREATE INDEX firebase_migration_records_target_idx
  ON firebase_migration_records (postgres_table, postgres_id);

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER topics_set_updated_at
BEFORE UPDATE ON topics
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER comments_set_updated_at
BEFORE UPDATE ON comments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER chats_set_updated_at
BEFORE UPDATE ON chats
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER messages_set_updated_at
BEFORE UPDATE ON messages
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
