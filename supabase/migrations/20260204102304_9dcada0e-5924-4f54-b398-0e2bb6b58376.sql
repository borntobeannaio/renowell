-- Создать функцию для получения канонической пары участников direct-чата
CREATE OR REPLACE FUNCTION get_direct_chat_pair(conv_id uuid)
RETURNS text AS $$
DECLARE
  participants text[];
BEGIN
  SELECT array_agg(user_id::text ORDER BY user_id)
  INTO participants
  FROM chat_participants
  WHERE conversation_id = conv_id;
  
  RETURN array_to_string(participants, ',');
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Создать таблицу для отслеживания уникальных пар direct-чатов
CREATE TABLE IF NOT EXISTS chat_direct_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  participant_pair text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(participant_pair)
);

-- Триггер для автоматического добавления пары при создании direct-чата
CREATE OR REPLACE FUNCTION ensure_unique_direct_chat()
RETURNS TRIGGER AS $$
DECLARE
  conv_type text;
  pair_text text;
  participant_count int;
BEGIN
  -- Получить тип чата
  SELECT type INTO conv_type FROM chat_conversations WHERE id = NEW.conversation_id;
  
  -- Только для direct чатов
  IF conv_type = 'direct' THEN
    -- Подсчитать участников
    SELECT count(*) INTO participant_count 
    FROM chat_participants 
    WHERE conversation_id = NEW.conversation_id;
    
    -- Если это второй участник (завершение создания direct-чата)
    IF participant_count = 2 THEN
      pair_text := get_direct_chat_pair(NEW.conversation_id);
      
      -- Попробовать вставить пару (если уже есть - ошибка)
      INSERT INTO chat_direct_pairs (conversation_id, participant_pair)
      VALUES (NEW.conversation_id, pair_text)
      ON CONFLICT (participant_pair) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_ensure_unique_direct_chat
AFTER INSERT ON chat_participants
FOR EACH ROW
EXECUTE FUNCTION ensure_unique_direct_chat();

-- Включить RLS
ALTER TABLE chat_direct_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated" ON chat_direct_pairs
FOR SELECT TO authenticated USING (true);