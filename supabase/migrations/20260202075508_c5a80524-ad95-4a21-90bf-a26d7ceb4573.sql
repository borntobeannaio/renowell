-- Add file_id columns for stable Telegram file identifiers
ALTER TABLE telegram_posts ADD COLUMN IF NOT EXISTS file_id TEXT;
ALTER TABLE telegram_posts ADD COLUMN IF NOT EXISTS video_file_id TEXT;

-- Add index for faster lookups by file_id
CREATE INDEX IF NOT EXISTS idx_telegram_posts_file_id ON telegram_posts(file_id) WHERE file_id IS NOT NULL;