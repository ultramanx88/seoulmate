ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS sticker_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';

ALTER TABLE comments
  DROP CONSTRAINT IF EXISTS comments_message_type_check;

ALTER TABLE comments
  ADD CONSTRAINT comments_message_type_check
  CHECK (message_type IN ('text', 'sticker'));

CREATE INDEX IF NOT EXISTS comments_sticker_id_idx
  ON comments (sticker_id)
  WHERE sticker_id IS NOT NULL;
