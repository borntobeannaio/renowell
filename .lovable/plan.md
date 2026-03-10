## Проблема

Триггер `on_profile_updated` **отсутствует в базе данных** (в секции db-triggers написано "There are no triggers in the database"). Предыдущая миграция не применилась. Без триггера автоматическая синхронизация profiles → employees не работает.

Ручная синхронизация в Profile.tsx присутствует и выглядит корректно — значит либо `proxyUpdate` для employees тихо завершается ошибкой, либо данные профиля не сохраняются в первую очередь.

## План

**1. Миграция — создать триггер заново:**

```sql
CREATE TRIGGER on_profile_updated
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_to_employee();
```

**2. Одноразовая синхронизация данных** (через insert tool):

```sql
UPDATE public.employees e
SET 
  full_name = COALESCE(NULLIF(CONCAT_WS(' ', p.first_name, p.last_name), ''), e.full_name),
  position = COALESCE(p.position, e.position),
  birthday = COALESCE(p.birthday, e.birthday),
  avatar_url = COALESCE(p.avatar_url, e.avatar_url),
  description = COALESCE(p.description, e.description)
FROM public.profiles p
WHERE e.profile_id = p.id;
```

Это подтянет все текущие данные из профилей (включая Опарина и Новикову) в таблицу сотрудников.

**3. Создать запись сотрудника для Артёма Покровского** (профиль без employee):

```sql
INSERT INTO public.employees (full_name, position, profile_id, avatar_url, birthday, description)
SELECT 
  COALESCE(NULLIF(CONCAT_WS(' ', first_name, last_name), ''), 'Артём Покровский'),
  COALESCE(position, 'Сотрудник'),
  id,
  avatar_url,
  birthday,
  description
FROM public.profiles
WHERE id = '8b000734-0488-485f-9fc5-13fcdeb2ca74';
```


| Шаг       | Что делаем                                              |
| --------- | ------------------------------------------------------- |
| Миграция  | Создать триггер `on_profile_updated`                    |
| Data sync | UPDATE employees из profiles для всех связанных записей |
| &nbsp;    | &nbsp;                                                  |


Код менять не нужно — ручная синхронизация в Profile.tsx уже корректна.