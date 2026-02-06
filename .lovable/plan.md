

# Добавить подробное логирование загрузки файлов

## Проблема

Загрузка файлов с телефона без VPN не работает, но логов нет — невозможно понять, на каком этапе сбой.

## Возможные причины

1. **CORS** — Yandex Cloud Function может не возвращать правильные CORS-заголовки для запросов с домена приложения
2. **S3-ключи/бакет** — в новой функции могут быть неправильные ключи или бакет
3. **Сетевая ошибка** — fetch падает ещё до получения ответа, и catch молча переходит на fallback (который тоже не работает без VPN)
4. **Ответ функции** — формат ответа может отличаться от ожидаемого (`url` vs другое поле)

## Что нужно сделать

### 1. Добавить подробные console.log в `useChatAttachments.ts`

Добавить логи на каждом этапе загрузки:
- Начало загрузки (имя файла, размер)
- Попытка отправки в Yandex Cloud Function
- Статус ответа или ошибка сети
- Тело ответа
- Попытка fallback (если сработал)
- Финальный результат или ошибку

Это позволит увидеть в консоли телефона (или при следующей проверке логов), что именно происходит.

### 2. Добавить таймаут через AbortController

Если запрос зависает, нужно прервать его через 30 секунд и показать пользователю ошибку вместо бесконечного ожидания.

## Файлы для изменения

| Файл | Действие |
|------|----------|
| `src/hooks/useChatAttachments.ts` | Добавить console.log на каждом этапе и AbortController с таймаутом 30 сек |

## Технические детали

Ключевые логи которые будут добавлены:

```text
[ChatUpload] Starting upload: photo.jpg (245 KB)
[ChatUpload] Sending to Yandex Function: https://functions.yandexcloud.net/d4e...
[ChatUpload] Yandex Function response: 200
[ChatUpload] Response body: { success: true, url: "..." }
  -- или --
[ChatUpload] Yandex Function network error: TypeError: Failed to fetch
[ChatUpload] Trying fallback (Supabase direct)...
[ChatUpload] Fallback response: 200
  -- или --
[ChatUpload] Upload failed: Error message here
```

Также добавится `AbortController` с таймаутом:

```text
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);
fetch(url, { signal: controller.signal, ... });
```

Это покажет точную точку отказа при следующей попытке загрузки.
