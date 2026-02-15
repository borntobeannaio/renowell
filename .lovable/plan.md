

## Полная интеграция внешнего ICS-календаря

### Что будет сделано

Пользователь вставляет ссылку на ICS-календарь (Outlook, Google) в профиле. Система автоматически скачивает и парсит ICS-файл, записывает события в общий календарь. Синхронизация запускается по крону каждые 15 минут.

### Изменения

#### 1. База данных

- Добавить колонку `ics_url text` в таблицу `profiles`
- Добавить колонку `source text DEFAULT 'internal'` в таблицу `calendar_events` (значения: `internal` / `external`)
- Добавить колонку `external_uid text` в таблицу `calendar_events` -- для идентификации внешних событий и предотвращения дублирования
- Уникальный индекс на `(creator_id, external_uid)` для защиты от дублей

#### 2. Поле ICS-ссылки в профиле (`src/pages/Profile.tsx`)

- Новое поле ввода "Ссылка на календарь (ICS)" между блоком "О себе" и кнопкой "Сохранить"
- Подсказка: "Вставьте ссылку на ICS-календарь из Outlook или Google Calendar"
- Сохраняется вместе с остальными данными профиля

#### 3. Edge-функция `sync-ics-calendar`

- Получает все профили с заполненным `ics_url`
- Скачивает ICS-файл по ссылке
- Парсит события (VEVENT): title, start, end, location, description, UID
- Записывает/обновляет события в `calendar_events` с `source = 'external'`
- Использует `external_uid` для upsert -- при повторном запуске обновляет существующие, добавляет новые, не дублирует
- Удаляет события, которых больше нет в ICS-файле (если они были ранее импортированы)

#### 4. Крон-задача

- Запуск `sync-ics-calendar` каждые 15 минут через `pg_cron` + `pg_net`
- Автоматическая синхронизация без участия пользователя

#### 5. UI календаря -- отображение внешних событий

- Внешние события отображаются с пометкой (иконка или бейдж "Outlook")
- Внешние события нельзя удалить из интерфейса (только внутренние)
- Обновить `useCalendarEvents` и `CalendarModule` для отображения `source`

### Технические детали

Файлы:

- Новая миграция: `ALTER TABLE profiles ADD COLUMN ics_url text; ALTER TABLE calendar_events ADD COLUMN source text DEFAULT 'internal'; ALTER TABLE calendar_events ADD COLUMN external_uid text; CREATE UNIQUE INDEX ...`
- `supabase/functions/sync-ics-calendar/index.ts` -- парсинг ICS + upsert событий
- `supabase/config.toml` -- добавить `[functions.sync-ics-calendar] verify_jwt = false`
- `src/pages/Profile.tsx` -- поле ICS-ссылки
- `src/hooks/useCurrentProfile.ts` -- обновить интерфейс `Profile`
- `src/hooks/useCalendarEvents.ts` -- обновить интерфейс `CalendarEvent`
- `src/components/modules/CalendarModule.tsx` -- пометка внешних событий, скрыть удаление для них
- SQL-вставка через insert tool: крон-задача `pg_cron` для запуска каждые 15 минут

