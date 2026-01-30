

# План: Исправление битых изображений в фотогалерее

## Диагностика проблемы

Текущая реализация имеет несколько проблем:

| Проблема | Причина |
|----------|---------|
| Preview URL-ы не загружаются | Yandex возвращает ссылки с авторизационными токенами, которые истекают или блокируются CORS |
| Download URL-ы тоже истекают | API `/download` возвращает временные ссылки (обычно на 2 часа) |
| Прямые запросы из браузера | CORS ограничения при обращении к `cloud-api.yandex.net` |

## Решение: Проксирование через Edge Function

Создать edge-функцию, которая будет серверным прокси для Yandex Disk:

```text
[Браузер] → [Edge Function yandex-disk-proxy] → [Yandex Disk API]
                    ↓
            Кэширование ссылок
            Обход CORS
            Стабильные URL-ы
```

## Архитектура

### Edge Function: `yandex-disk-proxy`

Два действия:
1. `list` — получить список фото из публичной папки
2. `image` — проксировать изображение (возвращает бинарные данные)

```typescript
// Список фото
POST { action: "list", publicUrl: "https://disk.yandex.ru/d/XXX" }
→ { photos: [{ id, name, preview, downloadUrl }] }

// Получить изображение (проксирование бинарных данных)  
GET /yandex-disk-proxy?url=<encoded_yandex_url>
→ binary image data с правильными Content-Type заголовками
```

### Изменения в PhotoGallery.tsx

1. Заменить прямые вызовы Yandex API на вызовы edge-функции
2. Использовать URL edge-функции для `src` изображений:

```tsx
// Вместо:
<img src={photo.preview} />

// Использовать:
<img src={`${EDGE_URL}/yandex-disk-proxy?url=${encodeURIComponent(photo.preview)}`} />
```

## Шаги реализации

### Шаг 1: Создать edge-функцию `yandex-disk-proxy`

```typescript
// supabase/functions/yandex-disk-proxy/index.ts
serve(async (req) => {
  const url = new URL(req.url);
  
  // GET запрос — проксирование изображения
  if (req.method === "GET") {
    const imageUrl = url.searchParams.get("url");
    const response = await fetch(imageUrl);
    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400", // Кэш на 24 часа
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
  
  // POST запрос — список файлов
  const { action, publicUrl } = await req.json();
  if (action === "list") {
    const apiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources?public_key=${encodeURIComponent(publicUrl)}&limit=100`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    // Обработка и возврат списка
  }
});
```

### Шаг 2: Обновить PhotoGallery.tsx

```typescript
// Новая функция для получения фото
async function fetchYandexPhotos(publicUrl: string): Promise<YandexPhoto[]> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/yandex-disk-proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "list", publicUrl }),
  });
  return response.json();
}

// Обёртка для URL изображений
function getProxiedImageUrl(originalUrl: string): string {
  return `${SUPABASE_URL}/functions/v1/yandex-disk-proxy?url=${encodeURIComponent(originalUrl)}`;
}
```

### Шаг 3: Использовать проксированные URL в компоненте

```tsx
<img 
  src={getProxiedImageUrl(photo.preview)} 
  alt={photo.title}
/>
```

## Альтернативное решение: Кэширование в Supabase Storage

Если edge-функция не справится с нагрузкой:

1. При первом запросе — скачать фото через edge-функцию
2. Сохранить в Supabase Storage
3. Вернуть стабильный публичный URL из Storage
4. При повторных запросах — отдавать из кэша

Это более надёжно, но требует хранилища.

## Файлы для изменения

1. **Создать**: `supabase/functions/yandex-disk-proxy/index.ts`
2. **Изменить**: `src/components/modules/hr/PhotoGallery.tsx`

## Ожидаемый результат

- Все изображения загружаются стабильно
- Нет CORS-ошибок
- Кэширование на уровне браузера (24 часа)
- Работает и для preview, и для полноразмерных изображений в Lightbox

