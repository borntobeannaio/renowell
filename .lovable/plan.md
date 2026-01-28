

# Создание таблицы audit_log для логирования изменений

Чтобы в будущем можно было восстановить потерянные данные, необходимо создать систему аудита изменений.

## Что будет реализовано

### 1. Таблица `audit_log`
Будет хранить историю всех изменений в ключевых таблицах протоколов:

| Поле | Описание |
|------|----------|
| id | UUID записи лога |
| table_name | Имя таблицы (protocol_items, protocol_sections, protocols) |
| record_id | ID изменённой записи |
| action | Тип операции: INSERT, UPDATE, DELETE |
| old_data | Старые значения (для UPDATE и DELETE) |
| new_data | Новые значения (для INSERT и UPDATE) |
| changed_by | ID пользователя, если доступен |
| changed_at | Время изменения |

### 2. Триггеры на таблицы
Автоматическая запись в audit_log при любых изменениях в:
- `protocol_items` (пункты протоколов)
- `protocol_sections` (секции)
- `protocols` (заголовки протоколов)

### 3. RLS политики
- Только чтение для авторизованных пользователей
- Запись только через триггеры (SECURITY DEFINER)

## Техническая реализация

```sql
-- Создание таблицы аудита
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Индексы для быстрого поиска
CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_changed_at ON audit_log(changed_at DESC);

-- Универсальная функция аудита
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Триггеры на таблицы
CREATE TRIGGER audit_protocol_items
  AFTER INSERT OR UPDATE OR DELETE ON protocol_items
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_protocol_sections
  AFTER INSERT OR UPDATE OR DELETE ON protocol_sections
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_protocols
  AFTER INSERT OR UPDATE OR DELETE ON protocols
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
```

## Что это даст

- История всех изменений с возможностью восстановления
- Поиск "кто и когда изменил" конкретный пункт
- Возможность откатить случайные удаления
- Логирование происходит автоматически, без изменений в коде приложения

