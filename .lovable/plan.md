

## Отправка ICS как настоящего приглашения (Accept/Decline в Outlook/Gmail)

### Проблема

Сейчас ICS отправляется как обычное вложение (attachment). Почтовые клиенты показывают его как файл для скачивания, а не как приглашение с кнопками "Принять / Отклонить".

### Решение

Нужно два изменения в `supabase/functions/send-calendar-invite/index.ts`:

**1. Добавить ATTENDEE в ICS**

Для каждого участника добавить строку `ATTENDEE` в сгенерированный ICS. Без этого Outlook не покажет кнопки принятия. Функция `generateICS` должна принимать массив участников:

```
ATTENDEE;CN=Анна Сирум;RSVP=TRUE;PARTSTAT=NEEDS-ACTION;ROLE=REQ-PARTICIPANT:mailto:anna@example.com
```

**2. Отправлять ICS и как inline alternative, и как вложение**

Для максимальной совместимости (Outlook + Gmail + Apple Mail) ICS нужно отправлять двумя способами одновременно:
- Как вложение с `content_type: "text/calendar; method=REQUEST; charset=UTF-8"` и `headers` с `Content-Disposition: inline` -- это покажет кнопки в Outlook
- Обычное вложение -- фоллбэк для клиентов, которые не поддерживают inline

Resend API поддерживает параметр `headers` на каждом attachment начиная с SDK v3.4+. Через REST API мы можем передать:

```json
{
  "attachments": [
    {
      "filename": "invite.ics",
      "content": "<base64>",
      "content_type": "text/calendar; method=REQUEST; charset=UTF-8",
      "headers": {
        "Content-Disposition": "inline; filename=\"invite.ics\""
      }
    }
  ]
}
```

### Файл: `supabase/functions/send-calendar-invite/index.ts`

**Изменения в `generateICS`:**
- Добавить параметр `attendees: { email: string; name: string }[]`
- Для каждого участника добавить строку ATTENDEE в ICS
- Убедиться что ORGANIZER стоит перед ATTENDEE

**Изменения в отправке:**
- Передать список `emails` в `generateICS` как attendees
- Генерировать персональный ICS для каждого получателя (чтобы его email был в ATTENDEE)
- Добавить `headers` к attachment для inline отображения
- Обновить текст письма (убрать фразу про "откройте файл .ics")

### Итоговый формат ICS

```text
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Renowell//Calendar//RU
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:xxx@renowell.app
DTSTAMP:20260217T120000Z
DTSTART:20260218T100000Z
DTEND:20260218T110000Z
SUMMARY:Статус проекта
ORGANIZER;CN=Иван Петров:mailto:account@renowell.silkagro.ru
ATTENDEE;CN=Анна Сирум;RSVP=TRUE;PARTSTAT=NEEDS-ACTION;ROLE=REQ-PARTICIPANT:mailto:anna@example.com
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR
```

### Результат

Outlook, Gmail и Apple Mail покажут встречу с кнопками "Принять / Под вопросом / Отклонить" прямо в теле письма.

