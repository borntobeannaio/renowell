

## Синхронизация профилей → сотрудники + описание в карточке

### Проблема

1. **Триггер `sync_profile_to_employee` не привязан** — функция существует, но триггер на таблице `profiles` не создан. Поэтому обновления профиля не синхронизируются автоматически.
2. В коде Profile.tsx синхронизация делается вручную (строки 131-139), но **не включает `description`**.
3. В таблице `employees` **нет колонки `description`**.
4. Карточка сотрудника в HRModule **не отображает описание**.

### План

**1. Миграция БД:**
- Добавить колонку `description text` в таблицу `employees`
- Создать триггер `on_profile_updated` на таблице `profiles` AFTER UPDATE, вызывающий `sync_profile_to_employee()`
- Обновить функцию `sync_profile_to_employee` — добавить синхронизацию поля `description`

```sql
ALTER TABLE public.employees ADD COLUMN description text;

CREATE OR REPLACE FUNCTION public.sync_profile_to_employee()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.employees SET 
    avatar_url = NEW.avatar_url,
    full_name = COALESCE(NULLIF(CONCAT_WS(' ', NEW.first_name, NEW.last_name), ''), 'Пользователь'),
    position = COALESCE(NEW.position, 'Сотрудник'),
    birthday = NEW.birthday,
    description = NEW.description
  WHERE profile_id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_updated
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_employee();
```

**2. `src/pages/Profile.tsx`** — добавить `description` в ручную синхронизацию employees (строка 134):
```typescript
description: description.trim() || null,
```

**3. `src/components/modules/HRModule.tsx`:**
- Добавить `description` в интерфейс `DbEmployee`
- Отобразить описание в карточке сотрудника (модалка)

**4. `src/hooks/useEmployees.ts`** — добавить `description` в интерфейс `DbEmployee`

| Файл | Изменения |
|---|---|
| Миграция | Колонка `description`, обновление функции, создание триггера |
| `Profile.tsx` | Добавить `description` в sync employees |
| `HRModule.tsx` | `description` в интерфейс + отображение в карточке |
| `useEmployees.ts` | `description` в интерфейс |
| `EditEmployeeModal.tsx` | `description` в интерфейс |

