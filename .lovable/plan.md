

## Исправление трёх багов при копировании и синхронизации протоколов

### Баг 1: Статус «Сделано» не копируется

**Причина:** В `ProtocolEditor.tsx` (строки 376-381) при копировании протокола для каждого пункта явно ставится `create_task: false, task_id: null`, но при этом `completed` и `completed_at` не переносятся -- они берутся из `createItemFromDb`, однако затем перезаписываются spread-оператором. На самом деле проблема в том, что `completed` из `createItemFromDb` передаётся корректно, но при создании протокола (`handleCreate`, строки 1433-1444) поля `completed` и `completed_at` **не передаются** в `createProtocolItem.mutateAsync`.

**Исправление:**
- В `handleCreate` добавить поля `completed` и `completed_at` при создании каждого пункта (аналогично тому, как это сделано в `handleSaveChanges` / `processSingleItem`)

### Баг 2: Задачи дублируются при сохранении скопированного протокола

**Причина:** При копировании (строки 378-380) выставляется `task_id: null`, чтобы не привязываться к задачам исходного протокола. Но логика в `handleCreate` (строки 1448-1476) при `task_id === null` создаёт **новую задачу** для каждого пункта. Это правильно для нового протокола, но при копировании задачи уже существуют и привязаны к исходному протоколу.

Исходный замысел (из memory) -- при копировании **сохранять ссылку на существующую задачу** (`task_id`), чтобы несколько протоколов могли указывать на одну и ту же задачу.

**Исправление:**
- В copy mode (строки 376-381) **не обнулять** `task_id` -- оставить оригинальный `task_id` из исходного пункта. Убрать `task_id: null` из маппинга при копировании. Это восстановит задуманное поведение: скопированный пункт ссылается на ту же задачу, что и оригинал.

### Баг 3: Комментарии к пунктам протокола не дублируются в задачу

**Причина:** При создании комментария к пункту протокола (через `ProtocolItemComments` → `useCreateProtocolItemComment`) комментарий записывается только в таблицу `protocol_item_comments`. В таблицу `task_comments` ничего не пишется. Хотя в UI комментарии из обоих источников объединяются (merged view), при открытии задачи на Kanban-доске комментарии из протокола не видны.

**Исправление:**
- В хуке `useCreateProtocolItemComment` при создании комментария к пункту, у которого есть `task_id`, одновременно создавать дубль комментария в таблице `task_comments` с тем же `author_id` и `content`.
- Для этого нужно передавать `task_id` в мутацию `useCreateProtocolItemComment`.

### Технические детали

**Файлы:**

1. **`src/pages/ProtocolEditor.tsx`**
   - Copy mode init (строки 376-381): убрать `task_id: null`, оставить `task_id: item.task_id`
   - `handleCreate` (строки 1379-1390 и 1433-1444): добавить `completed: item.completed || false` и `completed_at: item.completed_at || null` в вызов `createProtocolItem.mutateAsync`

2. **`src/hooks/useProtocolItemComments.ts`**
   - В `useCreateProtocolItemComment`: добавить параметр `taskId` в мутацию. Если `taskId` передан, после создания комментария в `protocol_item_comments` вставить копию в `task_comments` с теми же данными.

3. **`src/components/protocols/ProtocolItemComments.tsx`**
   - При вызове `createComment.mutateAsync` передавать `taskId` из пропсов, чтобы хук мог создать дубль в `task_comments`.

