
# Реакции на сообщения в чате

## Что будет сделано

Пользователи смогут ставить эмодзи-реакции на сообщения в чате. При нажатии на сообщение появится панель с набором реакций. Под сообщением будут отображаться поставленные реакции с количеством.

## Набор реакций

6 базовых эмодзи: 👍 ❤️ 😂 😮 😢 🔥

## Изменения в базе данных

Новая таблица `chat_message_reactions`:

```text
id          uuid (PK, default gen_random_uuid())
message_id  uuid (FK -> chat_messages.id ON DELETE CASCADE)
user_id     uuid (FK -> profiles.id ON DELETE CASCADE)  
emoji       text (NOT NULL)
created_at  timestamptz (default now())

UNIQUE(message_id, user_id, emoji)  -- один пользователь = одна реакция данного типа
```

RLS-политики:
- SELECT: участники беседы (через is_conversation_participant)
- INSERT: участники беседы, user_id = get_user_profile_id()
- DELETE: только свои реакции (user_id = get_user_profile_id())

Realtime: включить для мгновенного обновления реакций у всех участников.

## Изменения в коде

### 1. Новый хук `src/hooks/useChatReactions.ts`

- `useMessageReactions(conversationId)` -- загрузка всех реакций для сообщений беседы
- `useToggleReaction()` -- мутация: если реакция уже стоит -- удалить, иначе -- добавить
- Подписка на Realtime для автообновления

### 2. Новый компонент `src/components/chat/MessageReactions.tsx`

- Отображение реакций под сообщением (бейджи: эмодзи + счётчик)
- Свои реакции подсвечены
- Клик по существующей реакции -- toggle (добавить/убрать)

### 3. Новый компонент `src/components/chat/ReactionPicker.tsx`

- Панель с 6 эмодзи, появляется при наведении/нажатии на сообщение
- На десктопе -- hover, на мобильном -- long press

### 4. Обновление `src/components/chat/FloatingChat.tsx`

- В `renderMessages()` к каждому сообщению добавить `ReactionPicker` и `MessageReactions`
- Интеграция с существующей структурой сообщений

## Технические детали

### Структура данных реакций

```text
// Группировка реакций для отображения
interface ReactionGroup {
  emoji: string;
  count: number;
  hasOwn: boolean;  // текущий пользователь поставил эту реакцию
}
```

### Toggle логика

```text
toggleReaction(messageId, emoji):
  1. Проверить, есть ли уже такая реакция от текущего пользователя
  2. Если есть -- proxyDelete с фильтрами (message_id, user_id, emoji)
  3. Если нет -- proxyInsert { message_id, user_id, emoji }
  4. Invalidate query ["chat-reactions", conversationId]
```

### Realtime подписка

```text
supabase.channel('chat-reactions')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_message_reactions' })
  .subscribe()
  -> invalidateQueries(["chat-reactions"])
```

### UI под сообщением

```text
[Текст сообщения]
[Вложения]
[👍 2] [❤️ 1] [🔥 3]    <-- реакции (свои подсвечены)
12:45                      <-- время
```
