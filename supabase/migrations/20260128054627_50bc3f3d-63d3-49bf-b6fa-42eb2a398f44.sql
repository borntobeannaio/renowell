-- 1. Архивация секций и пунктов
ALTER TABLE protocol_sections ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;
ALTER TABLE protocol_items ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;

-- 2. Выполнение пунктов
ALTER TABLE protocol_items ADD COLUMN IF NOT EXISTS completed boolean DEFAULT false;
ALTER TABLE protocol_items ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- 3. Комментарии к пунктам
CREATE TABLE IF NOT EXISTS protocol_item_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES protocol_items(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE protocol_item_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view protocol item comments" 
  ON protocol_item_comments FOR SELECT USING (true);
CREATE POLICY "Auth users can insert protocol item comments" 
  ON protocol_item_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Authors can delete own protocol item comments" 
  ON protocol_item_comments FOR DELETE USING (author_id = get_user_profile_id());