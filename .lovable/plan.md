

## Обновление адреса отправителя во всех рассылках

Нужно заменить адрес `from` в двух edge-функциях на `account@renowell.silkagro.ru`.

### Изменения

**1. `supabase/functions/send-calendar-invite/index.ts`** (строка 188)

```
// Было:
from: "Реновель <onboarding@resend.dev>"
// Стало:
from: "Реновель Портал <account@renowell.silkagro.ru>"
```

**2. `supabase/functions/send-external-notification/index.ts`** (строка 274)

```
// Было:
from: "Реновель Портал <noreply@renowell.ru>"
// Стало:
from: "Реновель Портал <account@renowell.silkagro.ru>"
```

Два файла, по одной строке в каждом.

