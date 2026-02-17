

## Подтверждение удаления и редактирование встреч

### 1. Подтверждение удаления

В `CalendarModule.tsx` при нажатии на кнопку удаления (Trash2) — вместо прямого вызова `deleteEvent.mutate()` показывать AlertDialog с текстом "Удалить встречу «{title}»?" и кнопками "Отмена / Удалить". Используем уже установленный `@radix-ui/react-alert-dialog` (компонент `alert-dialog.tsx`).

### 2. Редактирование встречи

**Маршрут:** Добавить `/calendar/edit/:id` в `App.tsx`, переиспользуя страницу `CreateEvent`.

**Страница `CreateEvent.tsx`:** Переделать в универсальную create/edit форму:
- Считывать параметр `id` из URL (`useParams`)
- Если `id` есть — загрузить событие из `useCalendarEvents().events` и заполнить форму
- Изменить заголовок на "Редактировать встречу"
- Кнопка: "Сохранить" вместо "Создать и пригласить"
- При сохранении вызывать `updateEvent` вместо `createEvent`

**Хук `useCalendarEvents.ts`:** Добавить мутацию `updateEvent`:
- Вызов `proxyUpdate("calendar_events", ...)` для обновления полей
- После успешного обновления — вызов `send-calendar-invite` с параметром `{ event_id, update: true }` для пересылки обновленного ICS

**Кнопка редактирования:** В `CalendarModule.tsx` рядом с кнопкой удаления добавить кнопку "Редактировать" (иконка Pencil), которая ведёт на `/calendar/edit/{id}`. Показывать только для внутренних встреч, где `creator_id === profileId`.

### 3. Обновление ICS-приглашений

**Edge-функция `send-calendar-invite/index.ts`:**
- Принимать опциональный параметр `update: true` в body
- При обновлении использовать тот же UID из таблицы (`id` события) вместо `crypto.randomUUID()`, чтобы почтовые клиенты обновили событие, а не создали дубликат
- Добавить `SEQUENCE:1` (или инкрементировать) для обозначения обновления
- Тема письма: "Обновление: {title}" вместо "Приглашение: {title}"

### Технические детали

**Файлы для изменения:**

| Файл | Что меняется |
|---|---|
| `src/App.tsx` | Добавить маршрут `/calendar/edit/:id` |
| `src/pages/CreateEvent.tsx` | Поддержка режима редактирования (useParams, предзаполнение, updateEvent) |
| `src/hooks/useCalendarEvents.ts` | Добавить мутацию `updateEvent` с вызовом proxyUpdate + send-calendar-invite |
| `src/components/modules/CalendarModule.tsx` | AlertDialog для удаления + кнопка "Редактировать" |
| `supabase/functions/send-calendar-invite/index.ts` | Поддержка `update: true`, стабильный UID из event.id, SEQUENCE |

