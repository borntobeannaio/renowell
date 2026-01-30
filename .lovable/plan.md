
# План: Переход на Telegram Bot API для блога руководителя

## Текущее состояние

Сейчас посты канала `@oparinandrey_renowell` получаются через парсинг HTML страницы `t.me/s/...`. Это ненадёжно — HTML-структура может измениться, изображения приходят в сжатом виде.

## Важное ограничение Bot API

Telegram Bot API **не позволяет** получить историю сообщений канала напрямую. Метод `getUpdates` возвращает только **новые** обновления после того, как бот стал администратором.

## Решение: Гибридный подход

### Архитектура

```text
┌─────────────────────────────────────────────────────────────────┐
│                         Источники данных                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────────┐         ┌──────────────────────┐         │
│   │  HTML-парсинг    │         │   Telegram Webhook   │         │
│   │  (для старых     │         │   (для новых постов) │         │
│   │   постов)        │         │                      │         │
│   └────────┬─────────┘         └──────────┬───────────┘         │
│            │                              │                      │
│            └──────────────┬───────────────┘                      │
│                           ▼                                      │
│              ┌────────────────────────┐                          │
│              │   telegram_posts       │                          │
│              │   (кеш в БД)           │                          │
│              └────────────────────────┘                          │
│                           │                                      │
│                           ▼                                      │
│              ┌────────────────────────┐                          │
│              │   TelegramFeed UI      │                          │
│              └────────────────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Этапы реализации

#### 1. Обновить webhook для получения постов канала

**Файл:** `supabase/functions/telegram-webhook/index.ts`

Сейчас webhook обрабатывает только `message` (для привязки аккаунтов). Добавлю обработку `channel_post`:

- Если приходит `channel_post` из канала `@oparinandrey_renowell`:
  - Извлечь текст, дату, message_id
  - Если есть фото — получить file_id, вызвать `getFile`, скачать через `https://api.telegram.org/file/bot.../file_path`
  - Сохранить в таблицу `telegram_posts`

#### 2. Обновить setup-telegram-webhook

**Файл:** `supabase/functions/setup-telegram-webhook/index.ts`

Добавить `channel_post` в `allowed_updates`:

```typescript
allowed_updates: ["message", "channel_post"],
```

#### 3. Упростить telegram-channel edge function

**Файл:** `supabase/functions/telegram-channel/index.ts`

Теперь эта функция будет:
1. Читать посты из БД (которые туда попадают через webhook)
2. Если постов нет — сделать fallback на HTML-парсинг для первоначального заполнения
3. Возвращать закешированные посты

#### 4. Не менять фронтенд

Компоненты `TelegramFeed.tsx` и хук `useTelegramChannel.ts` останутся без изменений — они уже читают данные из БД.

---

## Техническая реализация

### telegram-webhook (обновление)

```typescript
// Обработка channel_post
const channelPost = update.channel_post;
if (channelPost) {
  const chat = channelPost.chat;
  // Проверяем что это нужный канал
  if (chat.username === 'oparinandrey_renowell') {
    await processChannelPost(supabase, TELEGRAM_BOT_TOKEN, channelPost);
  }
  return new Response(JSON.stringify({ ok: true }), {...});
}

async function processChannelPost(supabase, botToken, post) {
  const messageId = post.message_id;
  const text = post.text || post.caption || null;
  const date = new Date(post.date * 1000).toISOString();
  
  // Получить фото (если есть)
  let imageUrl = null;
  if (post.photo && post.photo.length > 0) {
    // Берём самое большое фото
    const largestPhoto = post.photo[post.photo.length - 1];
    imageUrl = await getFileUrl(botToken, largestPhoto.file_id);
  }
  
  // Видео thumbnail
  let videoUrl = null;
  if (post.video?.thumb) {
    videoUrl = await getFileUrl(botToken, post.video.thumb.file_id);
  }
  
  // Upsert в БД
  await supabase.from('telegram_posts').upsert({
    message_id: messageId,
    text,
    date,
    image_url: imageUrl,
    video_url: videoUrl,
    link: `https://t.me/oparinandrey_renowell/${messageId}`,
  }, { onConflict: 'message_id' });
}

async function getFileUrl(botToken, fileId) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
  const data = await res.json();
  if (data.ok && data.result.file_path) {
    return `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
  }
  return null;
}
```

### setup-telegram-webhook (обновление)

```typescript
body: JSON.stringify({
  url: webhookUrl,
  allowed_updates: ["message", "channel_post"],
  drop_pending_updates: false,  // Получить накопившиеся обновления
}),
```

### telegram-channel (упрощение)

```typescript
// Основная логика
const { data: posts } = await supabase
  .from('telegram_posts')
  .select('*')
  .order('date', { ascending: false })
  .limit(20);

// Если постов мало — fallback на HTML парсинг
if (!posts || posts.length < 5) {
  // Парсить HTML как раньше для первоначального заполнения
  const parsedPosts = await fetchAndParseHtml();
  await supabase.from('telegram_posts').upsert(parsedPosts, {...});
}

// Вернуть актуальные посты из БД
return { posts };
```

---

## Что изменится для пользователя

| До | После |
|-----|-------|
| Посты обновляются только при открытии страницы | Новые посты попадают в БД мгновенно через webhook |
| Изображения в сжатом виде (preview) | Полноразмерные изображения через Bot API |
| Если HTML-структура изменится — сломается | Надёжный Bot API |
| Парсинг ~9 постов | Все новые посты автоматически |

---

## Файлы для изменения

1. `supabase/functions/telegram-webhook/index.ts` — добавить обработку `channel_post`
2. `supabase/functions/setup-telegram-webhook/index.ts` — добавить `channel_post` в allowed_updates
3. `supabase/functions/telegram-channel/index.ts` — упростить до чтения из БД + fallback

После деплоя нужно будет вызвать `setup-telegram-webhook` чтобы обновить настройки webhook.
