

## Исправление часовых поясов и добавление новых полей из ICS

### Проблема с часовыми поясами

Парсер игнорирует параметр `TZID` в полях `DTSTART`/`DTEND`. Например:
- В ICS: `DTSTART;TZID=Europe/Moscow:20260112T140000` (14:00 по Москве)
- В базе: `14:00 UTC` (на 3 часа позже реального времени)
- Должно быть: `11:00 UTC`

### Что будет сделано

#### 1. Миграция базы данных -- новые колонки в `calendar_events`

```text
organizer     TEXT     -- имя/email организатора
attendees     JSONB    -- массив участников [{name, email, status}]
url           TEXT     -- ссылка на встречу (Zoom/Teams)
attachments   JSONB    -- массив вложений [{filename, url}]
```

#### 2. Edge-функция `sync-ics-calendar/index.ts`

**Исправление часовых поясов:**
- Извлекать `TZID` из строк `DTSTART;TZID=Europe/Moscow:...`
- Также проверять блок `VTIMEZONE` в файле для определения смещения
- Поддержать карту основных часовых поясов (Europe/Moscow = UTC+3, и др.)
- При наличии TZID вычитать смещение из локального времени для получения UTC
- Даты с суффиксом `Z` (уже UTC) обрабатывать как раньше

**Извлечение новых полей:**
- `ORGANIZER` -- формат `ORGANIZER;CN=Имя:mailto:email@example.com`. Извлекать имя (CN) и email.
- `ATTENDEE` -- может быть несколько строк. Формат `ATTENDEE;CN=Имя;PARTSTAT=ACCEPTED:mailto:email`. Извлекать имя, email, статус участия.
- `URL` -- простое текстовое поле со ссылкой на конференцию.
- `ATTACH` -- может быть несколько строк. Извлекать URL вложений.

**Передача в upsert:**
- Добавить новые поля в объект `eventData` при записи в БД.

#### 3. Обновление хука `useCalendarEvents.ts`

- Добавить новые поля в интерфейс `CalendarEvent`.

#### 4. Обновление UI `CalendarModule.tsx`

- Отображать организатора (если есть).
- Отображать список участников из ICS (attendees) с их статусами.
- Отображать ссылку на встречу (URL) как кликабельную кнопку.
- Отображать вложения (attachments) как список ссылок.

### Технические детали

**Карта часовых поясов** (основные, актуальные для пользователей):

```text
Europe/Moscow      -> +3
Europe/Minsk       -> +3  
Europe/Kiev        -> +2
Europe/Berlin      -> +1 (зима) / +2 (лето)
Europe/London      -> +0 (зима) / +1 (лето)
Asia/Yekaterinburg -> +5
Asia/Novosibirsk   -> +7
UTC                -> +0
```

Для корректной обработки летнего/зимнего времени функция будет определять смещение на основе конкретной даты события (проверяя, попадает ли дата в период DST для европейских зон). Для российских зон DST не применяется.

**Формат attendees в JSONB:**
```json
[
  {"name": "Иванов И.И.", "email": "ivanov@company.com", "status": "accepted"},
  {"name": "Петров П.П.", "email": "petrov@company.com", "status": "tentative"}
]
```

### Файлы для изменения

1. `supabase/migrations/...` -- новая миграция (4 колонки)
2. `supabase/functions/sync-ics-calendar/index.ts` -- парсер + часовые пояса
3. `src/hooks/useCalendarEvents.ts` -- интерфейс CalendarEvent
4. `src/components/modules/CalendarModule.tsx` -- отображение новых данных
