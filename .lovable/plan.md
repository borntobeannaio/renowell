

# План исправления маппинга проектов для задач из протоколов

## Описание проблемы

Задачи, созданные из секций протоколов типов **Тендеры**, **Бизнес-процессы** и **HR/Подбор персонала**, не попадают в соответствующие папки проектов на Kanban-доске и остаются в папке «Без проекта».

### Причины

Обнаружено **два места** с некорректной логикой:

1. **ProtocolEditor.tsx (строка 1654-1659)** — при обновлении существующей задачи `project_id` не передаётся:
   ```typescript
   await updateTask.mutateAsync({
     id: item.task_id,
     title: item.item_text,
     assignee_ids: assigneeProfileIds,
     due_date: item.due_date || null,
     // project_id НЕ ПЕРЕДАЁТСЯ!
   });
   ```

2. **sync-protocol-tasks Edge Function (строки 188-190, 313-315)** — маппинг проекта работает только для секций типа `project`, а для `tender`, `business`, `hr` возвращает `null`:
   ```typescript
   const projectId = item.protocol_sections?.section_type === 'project' 
     ? item.protocol_sections.entity_id 
     : null;  // ← для tender/business/hr всегда null!
   ```

### Существующий маппинг (ProtocolEditor.tsx)

```typescript
const SECTION_TYPE_PROJECT_IDS = {
  tender: "bf2ef5b4-1fe7-4e69-b533-30393a4d386b",   // Тендеры/задачи
  business: "5b30ab38-7ecd-4643-960e-8dc2bf353d98", // Бизнес процессы
  hr: "620c7f0e-6558-4116-8e80-7681457127b8",      // Подбор персонала
};
```

---

## Решение

### Шаг 1: Исправить ProtocolEditor.tsx

Добавить `project_id` при обновлении существующей задачи:

**Файл:** `src/pages/ProtocolEditor.tsx`  
**Строки:** 1654-1659

```typescript
// БЫЛО:
await updateTask.mutateAsync({
  id: item.task_id,
  title: item.item_text,
  assignee_ids: assigneeProfileIds,
  due_date: item.due_date || null,
});

// СТАНЕТ:
await updateTask.mutateAsync({
  id: item.task_id,
  title: item.item_text,
  assignee_ids: assigneeProfileIds,
  project_id: projectId,  // ← добавляем
  due_date: item.due_date || null,
});
```

---

### Шаг 2: Исправить sync-protocol-tasks Edge Function

Добавить маппинг типов секций на системные проекты.

**Файл:** `supabase/functions/sync-protocol-tasks/index.ts`

**2.1. Добавить константу маппинга (в начало файла после интерфейсов):**

```typescript
const SECTION_TYPE_PROJECT_IDS: Partial<Record<string, string>> = {
  tender: "bf2ef5b4-1fe7-4e69-b533-30393a4d386b",   // Тендеры/задачи
  business: "5b30ab38-7ecd-4643-960e-8dc2bf353d98", // Бизнес процессы
  hr: "620c7f0e-6558-4116-8e80-7681457127b8",      // Подбор персонала
};

function getProjectIdForSection(sectionType: string | null, entityId: string | null): string | null {
  if (sectionType === "project") {
    return entityId;
  }
  return sectionType ? SECTION_TYPE_PROJECT_IDS[sectionType] || null : null;
}
```

**2.2. Заменить логику в Step 2 (строка ~188):**

```typescript
// БЫЛО:
const projectId = latestItem.protocol_sections?.section_type === 'project' 
  ? latestItem.protocol_sections.entity_id 
  : null;

// СТАНЕТ:
const projectId = getProjectIdForSection(
  latestItem.protocol_sections?.section_type || null,
  latestItem.protocol_sections?.entity_id || null
);
```

**2.3. Заменить логику в Step 4 (строка ~313):**

```typescript
// БЫЛО:
const projectId = item.protocol_sections?.section_type === 'project' 
  ? item.protocol_sections.entity_id 
  : null;

// СТАНЕТ:
const projectId = getProjectIdForSection(
  item.protocol_sections?.section_type || null,
  item.protocol_sections?.entity_id || null
);
```

---

### Шаг 3: Миграция существующих данных

После обновления кода нужно запустить миграцию для исправления уже существующих задач с `project_id = NULL`.

**SQL-запрос для исправления:**

```sql
-- Обновить задачи из секций типа tender
UPDATE tasks t
SET project_id = 'bf2ef5b4-1fe7-4e69-b533-30393a4d386b'
FROM protocol_items pi
JOIN protocol_sections ps ON pi.section_id = ps.id
WHERE pi.task_id = t.id
  AND ps.section_type = 'tender'
  AND t.project_id IS NULL;

-- Обновить задачи из секций типа business
UPDATE tasks t
SET project_id = '5b30ab38-7ecd-4643-960e-8dc2bf353d98'
FROM protocol_items pi
JOIN protocol_sections ps ON pi.section_id = ps.id
WHERE pi.task_id = t.id
  AND ps.section_type = 'business'
  AND t.project_id IS NULL;

-- Обновить задачи из секций типа hr
UPDATE tasks t
SET project_id = '620c7f0e-6558-4116-8e80-7681457127b8'
FROM protocol_items pi
JOIN protocol_sections ps ON pi.section_id = ps.id
WHERE pi.task_id = t.id
  AND ps.section_type = 'hr'
  AND t.project_id IS NULL;
```

---

## Результат

После внесения изменений:

- Новые задачи из протоколов будут автоматически попадать в правильные папки
- Существующие задачи (после миграции) появятся в соответствующих проектах:
  - Тендерные пункты → папка «Тендеры/задачи»
  - Бизнес-процессы → папка «Бизнес процессы»
  - HR-задачи → папка «Подбор персонала»
- При редактировании протокола и сохранении — `project_id` задачи будет корректно обновляться

