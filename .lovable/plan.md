
# План: Улучшение уведомлений о задачах и добавление уведомлений о чатах

## Найденные проблемы

### Проблема 1: Типы уведомлений ограничены в базе данных
В таблице `notifications` есть CHECK constraint который разрешает только типы:
- `task_assigned`, `deadline_week`, `deadline_day`, `mention`

Тип `chat_message` **не разрешён**, поэтому уведомления о сообщениях в чате просто не вставляются!

### Проблема 2: Текст уведомлений о задачах неполный
Текущий формат:
- **Новая задача**: title="Новая задача", body="{название задачи}" — нужно: "У вас появилась новая задача: {название}"
- **Упоминание**: title="Вас упомянули в комментарии", body="{автор} в задаче 'Задача'" — нужно добавить текст комментария

### Проблема 3: Нет уведомлений при создании нового чата
Когда пользователя добавляют в чат, он не получает уведомление об этом

## Изменения в базе данных

### 1. Обновить CHECK constraint для типов уведомлений

```sql
ALTER TABLE notifications 
DROP CONSTRAINT notifications_type_check;

ALTER TABLE notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY[
  'task_assigned',
  'deadline_week', 
  'deadline_day',
  'mention',
  'chat_message',      -- уведомления о сообщениях
  'chat_created'       -- уведомления о добавлении в чат
]));
```

## Изменения в коде

### 1. Улучшить уведомления о новых задачах (`useTasks.ts`)

```typescript
// Было:
{
  recipient_id: assigneeId,
  type: 'task_assigned',
  title: 'Новая задача',
  body: task.title,
  related_task_id: newTask.id,
}

// Стало:
{
  recipient_id: assigneeId,
  type: 'task_assigned',
  title: 'У вас появилась новая задача',
  body: task.title,
  related_task_id: newTask.id,
}
```

### 2. Улучшить уведомления об упоминаниях (`useTaskComments.ts`)

```typescript
// Было:
{
  recipient_id: mentionedId,
  type: "mention",
  title: "Вас упомянули в комментарии",
  body: `${authorName} в задаче "${taskTitle}"`,
  related_task_id: taskId,
}

// Стало:
{
  recipient_id: mentionedId,
  type: "mention",
  title: `Вас упомянули в задаче "${taskTitle}"`,
  body: content.length > 150 ? content.substring(0, 150) + '...' : content,
  related_task_id: taskId,
}
```

### 3. Добавить уведомления о создании чата (`useChat.ts`)

```typescript
// В useCreateConversation — уведомить участников о добавлении:
{
  recipient_id: participantId,
  type: 'chat_created',
  title: 'Вас добавили в чат',
  body: title,
  link: `/chat/${conversation.id}`,
}
```

### 4. Исправить уведомления о сообщениях (`useChat.ts`)

Код уже есть, но не работал из-за constraint. После обновления базы начнёт работать:
```typescript
{
  recipient_id: participant.user_id,
  type: 'chat_message',
  title: `Сообщение от ${senderName}`,
  body: preview,
  link: `/chat/${conversationId}`,
}
```

### 5. Обновить типы и иконки уведомлений

**`useNotifications.ts`**:
```typescript
export type NotificationType = 
  | "task_assigned" 
  | "deadline_week" 
  | "deadline_day" 
  | "mention"
  | "chat_message"   // новый тип
  | "chat_created";  // новый тип
```

**`NotificationItem.tsx`**:
```typescript
const ICON_MAP: Record<string, typeof Bell> = {
  task_assigned: Bell,
  deadline_week: Clock,
  deadline_day: AlertTriangle,
  mention: AtSign,
  chat_message: MessageCircle,  // новый
  chat_created: Users,          // новый
};

const ICON_COLOR_MAP: Record<string, string> = {
  // ... существующие
  chat_message: "text-green-500",
  chat_created: "text-blue-500",
};
```

## Файлы для изменения

| Файл | Действие |
|------|----------|
| Миграция БД | Обновить CHECK constraint |
| `src/hooks/useNotifications.ts` | Добавить новые типы |
| `src/hooks/useTasks.ts` | Улучшить текст уведомления |
| `src/hooks/useTaskComments.ts` | Добавить текст комментария |
| `src/hooks/useChat.ts` | Добавить уведомления о чатах |
| `src/components/notifications/NotificationItem.tsx` | Добавить иконки |

## Ожидаемый результат

- Уведомление о новой задаче: "У вас появилась новая задача" + название задачи
- Уведомление об упоминании: "Вас упомянули в задаче '{название}'" + текст комментария
- Уведомление о новом сообщении: "Сообщение от {имя}" + превью текста
- Уведомление о добавлении в чат: "Вас добавили в чат" + название чата
