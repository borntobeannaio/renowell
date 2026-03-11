

# Переделка поиска на реальные данные из БД

## Проблема
`SearchModule` использует `useApp()`, который отдаёт моковые данные из `mockData.ts`. Реальные данные (сотрудники, протоколы, задачи) хранятся в БД и загружаются отдельными хуками (`useEmployees`, `useProtocols`, `useTasks`), но поиск их не использует.

## Решение
Переписать `SearchModule` так, чтобы он искал по данным из БД через существующие хуки.

### Изменения в `src/components/modules/SearchModule.tsx`:

1. Заменить `useApp()` на реальные хуки:
   - `useEmployees()` — сотрудники (поиск по `full_name`, `position`, `department`, `email`)
   - `useProtocols()` — протоколы (поиск по `title`, `attendees`)
   - `useTasks()` — задачи (поиск по `title`, `labels`)
   - Оставить `useApp()` только для `searchQuery` и навигации

2. Адаптировать поля поиска под структуру БД:
   - Сотрудники: `full_name` вместо `name`, `position` вместо `role`, `department` вместо `dept`
   - Протоколы: использовать поля из `useProtocols` (title, attendees)
   - Задачи: использовать поля из `useTasks` (title, labels, assignee через employees)

3. Убрать поиск по моковым `kbRubrics` и `chats` (если они не подключены к БД) или оставить заглушкой

### Затрагиваемые файлы:
- `src/components/modules/SearchModule.tsx` — основная переработка

