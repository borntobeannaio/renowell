
# План: Отправка картинок и файлов в Telegram уведомлениях

## Описание задачи

Когда пользователь отправляет сообщение с изображением или файлом в чат, уведомление в Telegram должно содержать не только текст сообщения, но и сам файл/изображение.

## Текущая архитектура

```text
┌─────────────────────────────────────────────────────────────────┐
│ FloatingChat (UI)                                                │
│   └─> useSendMessage                                             │
│         └─> Сохраняет в chat_messages (content + attachments)    │
│         └─> Создаёт notifications (только title + body + link)  │
│               └─> Триггер after_notification_insert              │
│                     └─> send-external-notification               │
│                           └─> sendTelegramMessage (только текст) │
└─────────────────────────────────────────────────────────────────┘
```

**Проблема:** Уведомления не хранят информацию о вложениях, поэтому Edge Function `send-external-notification` не может отправить их в Telegram.

## Решение

### Шаг 1: Добавить колонку для вложений в таблицу notifications

Добавить новую колонку `attachments` типа `jsonb` в таблицу `notifications`, которая будет хранить массив вложений:

```sql
ALTER TABLE notifications 
ADD COLUMN attachments jsonb DEFAULT NULL;
```

### Шаг 2: Передавать вложения при создании уведомления

В хуке `useSendMessage` (`src/hooks/useChat.ts`) при создании уведомления о новом сообщении добавить информацию о вложениях:

```typescript
// В useSendMessage, при создании уведомлений
await proxyInsert('notifications', {
  recipient_id: participant.user_id,
  type: 'chat_message',
  title: `Сообщение от ${senderName}`,
  body: preview,
  link: `#chat:${conversationId}`,
  attachments: attachments || null,  // <-- Добавляем вложения
});
```

### Шаг 3: Обновить Edge Function для отправки файлов в Telegram

В `send-external-notification` добавить логику отправки фото и документов через Telegram API:

**Для изображений** — использовать метод `sendPhoto`:
```typescript
// Telegram Bot API
POST /bot{token}/sendPhoto
{
  chat_id: "...",
  photo: "https://storage.yandexcloud.net/...",  // URL изображения
  caption: "Сообщение от Имя\n\nТекст сообщения"
}
```

**Для документов** — использовать метод `sendDocument`:
```typescript
POST /bot{token}/sendDocument
{
  chat_id: "...",
  document: "https://storage.yandexcloud.net/...",  // URL файла
  caption: "Сообщение от Имя\n\nТекст сообщения"
}
```

**Логика выбора метода:**
- Если `contentType` начинается с `image/` → `sendPhoto`
- Иначе → `sendDocument`

### Шаг 4: Обработка множественных вложений

Если сообщение содержит несколько вложений:
1. Первое вложение отправляется с текстом сообщения (caption)
2. Остальные вложения отправляются отдельными сообщениями без caption

---

## Технические детали

### Миграция базы данных

```sql
-- Добавить колонку для вложений в уведомления
ALTER TABLE notifications 
ADD COLUMN attachments jsonb DEFAULT NULL;

-- Добавить комментарий
COMMENT ON COLUMN notifications.attachments IS 
  'Массив вложений [{url, fileName, contentType, size}]';
```

### Изменения в `src/hooks/useChat.ts`

В функции `useSendMessage`, строки ~348-359:

```typescript
// Текущий код:
await proxyInsert('notifications', {
  recipient_id: participant.user_id,
  type: 'chat_message',
  title: `Сообщение от ${senderName}`,
  body: preview,
  link: `#chat:${conversationId}`,
});

// Новый код:
await proxyInsert('notifications', {
  recipient_id: participant.user_id,
  type: 'chat_message',
  title: `Сообщение от ${senderName}`,
  body: preview,
  link: `#chat:${conversationId}`,
  attachments: attachments && attachments.length > 0 ? attachments : null,
});
```

### Изменения в `send-external-notification/index.ts`

**1. Обновить интерфейс:**

```typescript
interface ChatAttachment {
  url: string;
  fileName: string;
  contentType: string;
  size: number;
}
```

**2. Обновить запрос уведомления:**

```typescript
const { data: notification, error: notifError } = await supabase
  .from("notifications")
  .select("id, recipient_id, type, title, body, link, attachments")  // Добавить attachments
  .eq("id", notification_id)
  .single();
```

**3. Добавить функции для отправки медиа:**

```typescript
async function sendTelegramPhoto(
  chatId: string,
  photoUrl: string,
  caption: string | null
): Promise<boolean> {
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption: caption || undefined,
        parse_mode: "HTML",
      }),
    }
  );
  const result = await response.json();
  return result.ok;
}

async function sendTelegramDocument(
  chatId: string,
  documentUrl: string,
  fileName: string,
  caption: string | null
): Promise<boolean> {
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        document: documentUrl,
        caption: caption || undefined,
        parse_mode: "HTML",
      }),
    }
  );
  const result = await response.json();
  return result.ok;
}
```

**4. Обновить основную функцию отправки:**

```typescript
async function sendTelegramNotification(
  chatId: string,
  title: string,
  body: string,
  link: string | null,
  attachments: ChatAttachment[] | null
): Promise<boolean> {
  // Формируем текст
  const emoji = typeEmojis[title] || "🔔";
  let caption = `${emoji} <b>${escapeHtml(title)}</b>\n\n${escapeHtml(body)}`;
  if (link) {
    caption += `\n\n<a href="${link}">Открыть →</a>`;
  }

  // Если нет вложений — отправляем обычное текстовое сообщение
  if (!attachments || attachments.length === 0) {
    return await sendTelegramMessage(chatId, title, body, link);
  }

  // Отправляем первое вложение с подписью
  const first = attachments[0];
  let success = false;

  if (first.contentType.startsWith("image/")) {
    success = await sendTelegramPhoto(chatId, first.url, caption);
  } else {
    success = await sendTelegramDocument(chatId, first.url, first.fileName, caption);
  }

  // Отправляем остальные вложения без подписи
  for (let i = 1; i < attachments.length; i++) {
    const att = attachments[i];
    if (att.contentType.startsWith("image/")) {
      await sendTelegramPhoto(chatId, att.url, null);
    } else {
      await sendTelegramDocument(chatId, att.url, att.fileName, null);
    }
  }

  return success;
}
```

**5. Добавить escape-функцию для HTML:**

```typescript
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
```

---

## Порядок реализации

1. Создать миграцию для добавления колонки `attachments` в таблицу `notifications`
2. Обновить `useChat.ts` — передавать вложения при создании уведомления
3. Обновить `send-external-notification` — добавить функции отправки фото/документов
4. Протестировать отправку сообщения с картинкой в чат

---

## Ограничения и особенности

- **Telegram ограничения**: Фото до 10 МБ, документы до 50 МБ через URL
- **Формат caption**: Используется HTML вместо MarkdownV2 (проще экранирование)
- **Множественные файлы**: Каждый файл отправляется отдельным сообщением
- **Email**: Вложения не добавляются в email (только ссылка на чат)
