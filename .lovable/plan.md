

# Исправление загрузки и отображения изображений без VPN

## Проблема

Пользователи без VPN не могут:
1. **Загружать файлы в чат** -- вызов edge-функции `yandex-s3-upload` идёт напрямую на Supabase, который заблокирован
2. **Видеть аватары в профилях** -- URL аватаров ведёт напрямую на Supabase Storage, который тоже заблокирован
3. **Загружать аватары** -- прокси-слой `storageProxy.ts` не использует Yandex Cloud прокси как fallback (баг в логике retry)

## Что будет исправлено

### 1. Загрузка файлов в чат (`useChatAttachments.ts`)

Перенаправить вызов `yandex-s3-upload` через Yandex Cloud прокси вместо прямого обращения к Supabase:

```text
Сейчас:   Браузер --> Supabase Edge Function (заблокировано)
Будет:    Браузер --> Yandex Cloud Function --> Supabase Edge Function
```

Добавить `_proxyTarget: "yandex-s3-upload"` в запрос через уже существующий Yandex Cloud прокси.

### 2. Исправление retry-логики `storageProxy.ts`

Сейчас функция `callStorageProxy` (через Yandex) определена, но не используется. Исправим порядок:
1. Сначала попытка через Yandex Cloud прокси
2. Если не удалось -- fallback на прямой вызов Supabase

### 3. Проксирование отображения аватаров

Аватары хранятся в Supabase Storage с URL вида `https://...supabase.co/storage/v1/...`. Для отображения без VPN нужно проксировать эти URL.

Создадим простую edge-функцию `avatar-proxy`, которая будет:
- Принимать путь к файлу в storage
- Скачивать его на сервере через Supabase SDK
- Отдавать бинарные данные клиенту

В коде приложения: при отображении аватаров подставлять проксированный URL через Yandex Cloud Function.

### 4. Обновление Yandex Cloud прокси

Добавить поддержку нового target `yandex-s3-upload` в документацию (Yandex Cloud Function уже поддерживает произвольные `_proxyTarget`).

---

## Технические детали

### Файлы для изменения

| Файл | Действие | Описание |
|------|----------|----------|
| `src/hooks/useChatAttachments.ts` | Изменить | Направить загрузку через Yandex Cloud прокси |
| `src/lib/storageProxy.ts` | Изменить | Исправить retry: сначала Yandex прокси, потом direct |
| `supabase/functions/avatar-proxy/index.ts` | Создать | Проксирование аватаров из Supabase Storage |
| `src/lib/avatarProxy.ts` | Создать | Утилита для построения проксированных URL аватаров |
| `src/pages/Profile.tsx` | Изменить | Использовать проксированные URL для отображения |
| `src/components/modules/HRModule.tsx` | Изменить | Использовать проксированные URL для аватаров сотрудников |
| `supabase/config.toml` | Обновится автоматически | Добавить конфигурацию `avatar-proxy` |

### Логика проксирования аватаров

```text
Сейчас:  <img src="https://...supabase.co/storage/v1/object/public/avatars/user123/avatar.jpg" />
         (заблокировано без VPN)

Будет:   <img src="https://functions.yandexcloud.net/d4e.../avatar-proxy?path=user123/avatar.jpg" />
         Yandex Cloud --> avatar-proxy edge function --> Supabase Storage --> бинарные данные
```

### Утилита `avatarProxy.ts`

Функция `getAvatarUrl(rawUrl)`:
- Если URL содержит `supabase.co/storage` -- преобразовать в проксированный через Yandex Cloud
- Иначе -- вернуть как есть

