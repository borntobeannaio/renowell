

# Отдельная Yandex Cloud Function для загрузки файлов (multipart)

## Идея

Вместо отправки base64 через JSON-прокси (который режет тело запроса), создать **отдельную Yandex Cloud Function** для загрузки файлов. Она будет принимать файлы как `multipart/form-data` и загружать напрямую в Yandex S3 -- точно так же, как на другом сайте.

```text
Сейчас (не работает):
  Браузер --> Yandex Proxy (JSON с base64) --> Supabase Edge Function --> Yandex S3
  (зависает из-за лимита на тело запроса)

Будет:
  Браузер --> Yandex Cloud Function (multipart/form-data) --> Yandex S3
  (напрямую, без Supabase, без base64, без лимитов)
```

## Что нужно сделать

### 1. Создать новую Yandex Cloud Function (вручную в консоли Яндекса)

Код на Node.js 18, аналогичный тому, что уже используется на другом сайте. Принимает `multipart/form-data` с полями:
- `file` -- сам файл
- `folder` -- папка в S3 (по умолчанию `chat-files`)

Секреты S3 (access key, secret key, bucket name) уже есть -- те же, что используются в edge-функции `yandex-s3-upload`.

### 2. Обновить `src/hooks/useChatAttachments.ts`

Заменить текущую логику (base64 через JSON) на отправку `FormData` напрямую в новую Yandex Cloud Function:

```text
const formData = new FormData();
formData.append('file', file);
formData.append('folder', 'chat-files');

fetch(YANDEX_UPLOAD_FUNCTION_URL, {
  method: 'POST',
  body: formData,  // браузер сам выставит Content-Type: multipart/form-data
});
```

Преимущества:
- Нет base64 (+33% overhead) -- файл идёт в бинарном виде
- Нет лимита на размер (Yandex Cloud Function поддерживает до 10 МБ в multipart)
- Не проходит через Supabase -- VPN не нужен
- Проверенное решение -- уже работает на другом сайте

## Технические детали

### Файлы для изменения в проекте Lovable

| Файл | Действие | Описание |
|------|----------|----------|
| `src/hooks/useChatAttachments.ts` | Изменить | Отправка через FormData в новую функцию |

### Yandex Cloud Function (создаётся в консоли Яндекса вручную)

Код функции -- адаптированная версия того, что уже работает на другом сайте:

```text
Настройки:
- Runtime: Node.js 18
- Таймаут: 30 сек
- Память: 128 МБ
- Публичный доступ: Да
- Переменные окружения:
  S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET (или захардкодить как на другом сайте)
```

Код будет содержать:
- `parseMultipart()` -- парсинг multipart body
- `signRequest()` -- AWS v4 подпись
- `uploadToS3()` -- PUT в Yandex S3
- Handler -- обработка запроса

### Логика в `useChatAttachments.ts`

```text
1. Создаём FormData с файлом и папкой
2. POST в YANDEX_UPLOAD_FUNCTION_URL (новая функция)
3. Получаем { success: true, url: "https://storage.yandexcloud.net/...", key: "..." }
4. Возвращаем url как ссылку на файл
```

### Что потребуется от вас

1. Создать новую Yandex Cloud Function в консоли Яндекса (я дам готовый код)
2. Вставить в неё код с вашими S3-ключами (или теми же, что на другом сайте, если бакет тот же)
3. Сообщить мне URL новой функции (вида `https://functions.yandexcloud.net/d4e...`)
4. Я обновлю `useChatAttachments.ts` с новым URL

### Fallback

Если новая функция недоступна -- fallback на прямой вызов Supabase Edge Function `yandex-s3-upload` (для пользователей с VPN).

