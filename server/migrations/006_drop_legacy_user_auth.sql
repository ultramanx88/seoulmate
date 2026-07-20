DROP TABLE IF EXISTS oauth_states;
DROP TABLE IF EXISTS auth_sessions;
DROP TABLE IF EXISTS firebase_migration_records;
DROP INDEX IF EXISTS users_firebase_uid_key;
ALTER TABLE users DROP COLUMN IF EXISTS firebase_uid;
ALTER TABLE users ALTER COLUMN auth_provider SET DEFAULT 'clerk';
