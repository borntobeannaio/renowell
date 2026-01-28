
# План: Расширение редактора протоколов и Kanban-доски

## Обзор задачи
Добавить функционал свёртки секций, архивации, нумерации, комментирования пунктов протокола и обновить статусы задач Kanban.

---

## Часть 1: Редактор протоколов

### 1.1 Кнопка «Свернуть/Развернуть все секции»
**Файлы:** `src/pages/ProtocolEditor.tsx`

- Добавить состояние `allSectionsCollapsed: boolean`
- Добавить кнопку в шапку редактора рядом с «Добавить секцию»
- Передавать состояние свёрнутости в каждый компонент `UniversalSection` через проп `forceExpanded`

### 1.2 Удаление секции без удаления пунктов
**Файлы:** `src/components/protocols/UniversalSection.tsx`

- Текущая логика: кнопка удаления секции появляется только когда `items.length === 0`
- Новая логика: всегда показывать кнопку удаления
- При удалении секции с пунктами → показывать диалог выбора:
  - «Удалить секцию и переместить пункты в другую секцию»
  - «Удалить секцию и все пункты»
- Добавить модальное окно выбора целевой секции

### 1.3 Архивация секций и пунктов
**Изменения в БД:**
```sql
-- Добавить поле archived для секций
ALTER TABLE protocol_sections ADD COLUMN archived boolean DEFAULT false;

-- Добавить поле archived для пунктов
ALTER TABLE protocol_items ADD COLUMN archived boolean DEFAULT false;
```

**Файлы для изменений:**
- `src/hooks/useProtocolSections.ts` — добавить поле `archived` в типы
- `src/hooks/useProtocols.ts` — добавить поле `archived` в `DbProtocolItem`
- `src/components/protocols/UniversalSection.tsx` — кнопка архивации секции
- `src/components/protocols/ProtocolItemEditor.tsx` — кнопка архивации пункта
- `src/components/protocols/GoalItemEditor.tsx` — кнопка архивации пункта
- `src/pages/ProtocolEditor.tsx`:
  - Фильтрация архивных элементов по умолчанию
  - Переключатель «Показать архив»
  - Панель архива со списком и кнопками восстановления

### 1.4 Нумерация пунктов как в PDF
**Файлы:** 
- `src/components/protocols/ProtocolItemEditor.tsx`
- `src/components/protocols/GoalItemEditor.tsx`
- `src/components/protocols/DroppableSection.tsx`

**Логика:**
- Передавать в каждый `DraggableItem` индексы: `sectionIndex` и `itemIndex`
- Отображать номер слева от пункта: «1.1», «1.2», «2.1» и т.д.

### 1.5 Комментарии к пунктам протокола
**Изменения в БД:**
```sql
CREATE TABLE protocol_item_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES protocol_items(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS политики
ALTER TABLE protocol_item_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view" ON protocol_item_comments FOR SELECT USING (true);
CREATE POLICY "Auth users can insert" ON protocol_item_comments FOR INSERT WITH CHECK (author_id = get_user_profile_id());
CREATE POLICY "Authors can delete" ON protocol_item_comments FOR DELETE USING (author_id = get_user_profile_id());
```

**Новые файлы:**
- `src/hooks/useProtocolItemComments.ts` — CRUD хуки для комментариев
- `src/components/protocols/ProtocolItemComments.tsx` — UI компонент комментариев

**Изменения:**
- `src/components/protocols/ProtocolItemEditor.tsx` — добавить секцию комментариев (collapsible)
- `src/components/protocols/GoalItemEditor.tsx` — добавить секцию комментариев
- `src/utils/protocolPdf.ts` — выгружать комментарии под каждым пунктом

### 1.6 Пометка пункта как выполненного
**Изменения в БД:**
```sql
ALTER TABLE protocol_items ADD COLUMN completed boolean DEFAULT false;
ALTER TABLE protocol_items ADD COLUMN completed_at timestamptz;
```

**Файлы:**
- `src/hooks/useProtocols.ts` — добавить поля в тип
- `src/components/protocols/ProtocolItemEditor.tsx` — чекбокс «Выполнено»
- `src/components/protocols/GoalItemEditor.tsx` — чекбокс «Выполнено»
- `src/utils/protocolPdf.ts` — отображать статус выполнения в PDF (зачёркнутый текст или иконка)

---

## Часть 2: Kanban-доска задач

### 2.1 Новые статусы задач
**Изменения:**
- `src/hooks/useTasks.ts`:
  - Изменить `TaskStatus` на: `"new" | "in_progress" | "review" | "done" | "archived"`
  - Обновить `TASK_STATUS_LABELS`
  - Добавить `TASK_PRIORITY_COLORS` (уже есть)

- `src/components/modules/TasksModule.tsx`:
  - Обновить массив `columns` на 4 основных + скрытый Архив
  - Добавить переключатель «Показать архив»
  - Задачи в архиве не показываются по умолчанию
  - Добавить кнопку архивации на карточку задачи

**Новые статусы:**
| Статус | Название | Описание |
|--------|----------|----------|
| new | Новая | Только создана |
| in_progress | В работе | Активная работа |
| review | На проверке | Ожидает проверки |
| done | Готово | Завершена |
| archived | Архив | Скрыта из основного вида |

---

## Технические детали

### Миграция БД (одна миграция)
```sql
-- 1. Архивация секций и пунктов
ALTER TABLE protocol_sections ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;
ALTER TABLE protocol_items ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;

-- 2. Выполнение пунктов
ALTER TABLE protocol_items ADD COLUMN IF NOT EXISTS completed boolean DEFAULT false;
ALTER TABLE protocol_items ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- 3. Комментарии к пунктам
CREATE TABLE IF NOT EXISTS protocol_item_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES protocol_items(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE protocol_item_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view protocol item comments" 
  ON protocol_item_comments FOR SELECT USING (true);
CREATE POLICY "Auth users can insert protocol item comments" 
  ON protocol_item_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Authors can delete own protocol item comments" 
  ON protocol_item_comments FOR DELETE USING (author_id = get_user_profile_id());
```

### Порядок реализации
1. Миграция БД (один запрос)
2. Обновить типы в хуках (`useProtocols`, `useProtocolSections`, `useTasks`)
3. Создать `useProtocolItemComments` хук
4. Обновить компоненты редактора протоколов:
   - Нумерация пунктов
   - Кнопка свёртки всех секций
   - Архивация
   - Выполнение
   - Комментарии
5. Обновить компонент удаления секции
6. Обновить TasksModule (статусы + архив)
7. Обновить PDF-экспорт

### Файлы для изменения/создания

**Новые файлы:**
- `src/hooks/useProtocolItemComments.ts`
- `src/components/protocols/ProtocolItemComments.tsx`

**Изменяемые файлы:**
- `src/pages/ProtocolEditor.tsx`
- `src/components/protocols/UniversalSection.tsx`
- `src/components/protocols/ProtocolItemEditor.tsx`
- `src/components/protocols/GoalItemEditor.tsx`
- `src/components/protocols/DroppableSection.tsx`
- `src/components/protocols/DraggableItem.tsx`
- `src/hooks/useProtocols.ts`
- `src/hooks/useProtocolSections.ts`
- `src/hooks/useTasks.ts`
- `src/components/modules/TasksModule.tsx`
- `src/utils/protocolPdf.ts`

---

## Ожидаемый результат

### Редактор протоколов:
- Кнопка «Свернуть все / Развернуть все» в шапке
- Удаление секции с выбором куда переместить пункты
- Архивация секций и пунктов + панель восстановления
- Нумерация «1.1, 1.2, 2.1» как в PDF
- Комментарии к пунктам с выгрузкой в PDF
- Чекбокс «Выполнено» для пунктов

### Kanban:
- 4 основных колонки: Новая → В работе → На проверке → Готово
- Архив как скрытая 5-я колонка с переключателем
