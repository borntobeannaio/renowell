

## План: Добавить Аннакулиева Андрея и исправить ошибки сборки

### 1. Создать сотрудника Аннакулиев Андрей
- Вызвать edge function `create-employee-user` для создания:
  - **ФИО:** Аннакулиев Андрей
  - **Должность:** Менеджер по работе с ключевыми клиентами
  - **Телефон:** +7 (909) 929-20-00
  - **Email:** A.annakuliev@renowell.ru
- Это создаст: auth user, profile и employee запись

### 2. Добавить аудит-триггер на таблицу employees
- Чтобы в будущем отслеживать удаления/изменения сотрудников
```sql
CREATE TRIGGER audit_employees
  AFTER INSERT OR UPDATE OR DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
```

### 3. Исправить ошибки сборки
- `TelegramLinkDialog.tsx` и `ProtocolEditor.tsx`: заменить `NodeJS.Timeout` на `ReturnType<typeof setTimeout>`

