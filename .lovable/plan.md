
# План: Исправление дублирования личных чатов

## Описание проблемы

При создании нового личного чата через виджет (кнопка в углу → «Начать новый чат» → выбор сотрудника) система иногда создает новый пустой чат вместо открытия уже существующего диалога с этим человеком.

## Анализ причин

Текущая логика в `useCreateConversation` уже содержит проверку на существующий чат через `useFindDirectConversation`, но она может не сработать по следующим причинам:

1. **Отсутствие лимитов в запросах** — функция `proxySelect` может вернуть неполный список участников
2. **Ненадежная обработка ошибок** — при любой ошибке сети функция возвращает `null` и создается дубликат
3. **Нет логирования** — невозможно отследить почему поиск не нашел существующий чат

## Решение

### Шаг 1: Улучшить функцию поиска существующего чата

Переписать `useFindDirectConversation` с:
- Добавлением больших лимитов (1000 записей)
- Улучшенной обработкой ошибок с логированием
- Проверкой на пустые данные

### Шаг 2: Добавить двойную проверку в мутации

В `useCreateConversation` добавить:
- Повторный запрос к БД напрямую перед созданием
- Проверку с использованием одного SQL-запроса вместо трех последовательных

### Шаг 3: Добавить уникальный индекс в базу данных

Создать составной уникальный индекс для предотвращения дубликатов на уровне БД:
- Индекс на паре участников для direct-чатов
- Триггер для проверки перед вставкой

---

## Технические детали

### Файл: `src/hooks/useChat.ts`

**Изменение 1**: Переписать `useFindDirectConversation` (строки 83-123)

```typescript
export function useFindDirectConversation() {
  return async (profileId: string, otherProfileId: string): Promise<string | null> => {
    console.log('[findDirectConversation] Searching for existing chat between', profileId, 'and', otherProfileId);
    
    try {
      // Step 1: Get all conversations where current user is a participant
      const { data: myConversations, error: myError } = await proxySelect<{ conversation_id: string }>('chat_participants', {
        select: 'conversation_id',
        filters: [{ column: 'user_id', operator: 'eq', value: profileId }],
        limit: 1000, // Увеличенный лимит
      });

      if (myError) {
        console.error('[findDirectConversation] Error fetching my conversations:', myError);
        return null;
      }
      
      if (!myConversations?.length) {
        console.log('[findDirectConversation] User has no conversations');
        return null;
      }

      const conversationIds = myConversations.map(c => c.conversation_id);
      console.log('[findDirectConversation] Found', conversationIds.length, 'conversations for current user');

      // Step 2: Filter only direct conversations
      const { data: directConversations, error: convError } = await proxySelect<{ id: string }>('chat_conversations', {
        select: 'id',
        filters: [
          { column: 'id', operator: 'in', value: conversationIds },
          { column: 'type', operator: 'eq', value: 'direct' },
        ],
        limit: 1000,
      });

      if (convError) {
        console.error('[findDirectConversation] Error fetching direct conversations:', convError);
        return null;
      }
      
      if (!directConversations?.length) {
        console.log('[findDirectConversation] No direct conversations found');
        return null;
      }

      const directConvIds = directConversations.map(c => c.id);
      console.log('[findDirectConversation] Found', directConvIds.length, 'direct conversations');

      // Step 3: Check if the other user is also a participant
      const { data: otherParticipations, error: otherError } = await proxySelect<{ conversation_id: string }>('chat_participants', {
        select: 'conversation_id',
        filters: [
          { column: 'user_id', operator: 'eq', value: otherProfileId },
          { column: 'conversation_id', operator: 'in', value: directConvIds },
        ],
        limit: 1000,
      });

      if (otherError) {
        console.error('[findDirectConversation] Error checking other user participation:', otherError);
        return null;
      }
      
      if (!otherParticipations?.length) {
        console.log('[findDirectConversation] Other user is not in any direct conversation with current user');
        return null;
      }

      console.log('[findDirectConversation] Found existing conversation:', otherParticipations[0].conversation_id);
      return otherParticipations[0].conversation_id;
    } catch (error) {
      console.error('[findDirectConversation] Unexpected error:', error);
      return null;
    }
  };
}
```

**Изменение 2**: Добавить вторую проверку в `useCreateConversation` (строки 154-167)

```typescript
// For direct chats, check if conversation already exists
if (type === "direct" && participantIds.length === 1) {
  const otherProfileId = participantIds[0];
  
  // First attempt - use the findDirectConversation function
  let existingConvId = await findDirectConversation(profile.id, otherProfileId);
  
  // If not found, do a direct database check as backup
  if (!existingConvId) {
    console.log('[createConversation] First search found nothing, doing backup check...');
    
    // Direct query: find conversation where both users are participants
    const { data: myParticipations } = await proxySelect<{ conversation_id: string }>('chat_participants', {
      select: 'conversation_id',
      filters: [{ column: 'user_id', operator: 'eq', value: profile.id }],
      limit: 1000,
    });
    
    if (myParticipations?.length) {
      const myConvIds = myParticipations.map(p => p.conversation_id);
      
      const { data: sharedParticipations } = await proxySelect<{ conversation_id: string }>('chat_participants', {
        select: 'conversation_id',
        filters: [
          { column: 'user_id', operator: 'eq', value: otherProfileId },
          { column: 'conversation_id', operator: 'in', value: myConvIds },
        ],
        limit: 1000,
      });
      
      if (sharedParticipations?.length) {
        // Check if any of these are direct chats
        const { data: directChats } = await proxySelect<{ id: string }>('chat_conversations', {
          select: 'id',
          filters: [
            { column: 'id', operator: 'in', value: sharedParticipations.map(p => p.conversation_id) },
            { column: 'type', operator: 'eq', value: 'direct' },
          ],
          limit: 1,
        });
        
        if (directChats?.[0]) {
          existingConvId = directChats[0].id;
          console.log('[createConversation] Backup check found existing conversation:', existingConvId);
        }
      }
    }
  }
  
  if (existingConvId) {
    // Return existing conversation info
    const { data: existingConv } = await proxySelect<ChatConversation>('chat_conversations', {
      filters: [{ column: 'id', operator: 'eq', value: existingConvId }],
      limit: 1,
    });
    if (existingConv?.[0]) {
      console.log('[createConversation] Returning existing conversation:', existingConv[0].id);
      return existingConv[0];
    }
  }
  
  console.log('[createConversation] No existing conversation found, will create new one');
}
```

### База данных: Добавить уникальный индекс

Создать миграцию для предотвращения дубликатов на уровне БД:

```sql
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
$$ LANGUAGE plpgsql;

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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ensure_unique_direct_chat
AFTER INSERT ON chat_participants
FOR EACH ROW
EXECUTE FUNCTION ensure_unique_direct_chat();

-- Включить RLS
ALTER TABLE chat_direct_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated" ON chat_direct_pairs
FOR SELECT TO authenticated USING (true);
```

---

## Порядок реализации

1. Обновить `useFindDirectConversation` с логированием и увеличенными лимитами
2. Добавить двойную проверку в `useCreateConversation`
3. Создать миграцию БД для уникального индекса
4. Протестировать создание чата с существующим собеседником
