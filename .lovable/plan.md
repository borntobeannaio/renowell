
# План: Исправление истекающих изображений в блоге руководителя

## Диагностика проблемы

| Что сейчас | Почему не работает |
|------------|-------------------|
| Webhook получает `file_id` от Telegram | ✅ Работает |
| Вызывает `getFile` API и получает временный URL | ⚠️ URL истекает через ~1 час |
| Сохраняет этот URL в `image_url` | ❌ Через час URL возвращает 404 |
| Прокси пытается загрузить по старому URL | ❌ 404 Not Found |

## Решение

Аналогично тому, как мы исправили Yandex Disk — хранить **стабильные идентификаторы** (`file_id`), а свежие URL получать в момент отображения.

```text
Текущая схема (сломана):
[Webhook] → getFile → URL → DB → [Браузер] → 404

Новая схема (стабильная):
[Webhook] → file_id → DB
[Браузер] → [telegram-image-proxy] → getFile (свежий URL) → fetch → image
```

## Изменения в базе данных

Добавить колонку `file_id` в таблицу `telegram_posts`:

```sql
ALTER TABLE telegram_posts ADD COLUMN IF NOT EXISTS file_id TEXT;
ALTER TABLE telegram_posts ADD COLUMN IF NOT EXISTS video_file_id TEXT;
```

## Изменения в Edge Functions

### 1. Обновить `telegram-webhook` (сохранять file_id)

```typescript
// Вместо:
imageUrl = await getFileUrl(botToken, largestPhoto.file_id);

// Сохранять file_id напрямую:
const fileId = largestPhoto.file_id;

// В upsert:
{
  ...
  file_id: fileId,        // стабильный идентификатор
  image_url: null,        // больше не нужен
}
```

### 2. Создать `telegram-image-proxy` (получать свежие URL)

Новая edge-функция для проксирования Telegram изображений:

```typescript
// GET /telegram-image-proxy?file_id=XXX

serve(async (req) => {
  const url = new URL(req.url);
  const fileId = url.searchParams.get('file_id');
  
  // 1. Получить свежий file_path через Bot API
  const response = await fetch(
    `https://api.telegram.org/bot${TOKEN}/getFile?file_id=${fileId}`
  );
  const { result } = await response.json();
  
  // 2. Загрузить изображение
  const imageUrl = `https://api.telegram.org/file/bot${TOKEN}/${result.file_path}`;
  const imageResponse = await fetch(imageUrl);
  
  // 3. Вернуть с кэшированием
  return new Response(imageResponse.body, {
    headers: {
      'Content-Type': imageResponse.headers.get('Content-Type'),
      'Cache-Control': 'public, max-age=3600', // кэш на 1 час
    }
  });
});
```

### 3. Обновить `TelegramFeed.tsx`

```typescript
function getProxiedImageUrl(post: TelegramPost): string | null {
  // Если есть file_id — использовать новый прокси
  if (post.file_id) {
    return `${SUPABASE_URL}/functions/v1/telegram-image-proxy?file_id=${post.file_id}`;
  }
  // Fallback для старых постов с image_url
  if (post.image_url) {
    return `${SUPABASE_URL}/functions/v1/yandex-disk-proxy?url=${encodeURIComponent(post.image_url)}`;
  }
  return null;
}
```

## Миграция старых данных

Для постов, которые уже в БД с протухшими URL:
1. Удалить старые записи или
2. Перезапустить парсинг HTML (fallback в `telegram-channel`)

Предлагаю очистить старые записи и дать webhook заново наполнить базу:
```sql
DELETE FROM telegram_posts WHERE file_id IS NULL;
```

## Файлы для изменения

| Файл | Действие |
|------|----------|
| Миграция БД | Добавить колонки `file_id`, `video_file_id` |
| `supabase/functions/telegram-webhook/index.ts` | Сохранять `file_id` вместо URL |
| `supabase/functions/telegram-image-proxy/index.ts` | **Создать** новую функцию |
| `src/hooks/useTelegramChannel.ts` | Добавить `file_id` в интерфейс |
| `src/components/modules/brandhub/TelegramFeed.tsx` | Использовать новый прокси |

## Ожидаемый результат

- Изображения будут загружаться стабильно, даже через дни/недели
- Каждый запрос получает свежий URL от Telegram API
- Кэширование на 1 час снижает нагрузку на API
- Старые посты (без file_id) будут показываться без картинок или удалены
