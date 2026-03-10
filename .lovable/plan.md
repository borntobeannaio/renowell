

# Уведомления при добавлении исполнителя в существующую задачу

## Проблема
`useUpdateTask` не создаёт уведомлений при изменении `assignee_ids`. Уведомления работают только при создании новой задачи.

## Решение

**Файл: `src/hooks/useTasks.ts` — мутация `useUpdateTask`**

После успешного обновления задачи, если в `updates` есть `assignee_ids`:
1. Сравнить новый список `assignee_ids` с предыдущим (нужно передавать старые значения или загружать задачу до обновления).
2. Для каждого **нового** исполнителя (которого не было раньше) создать уведомление `task_assigned`.

Простейший подход — передавать `previousAssigneeIds` в мутацию:

```typescript
mutationFn: async ({ id, previousAssigneeIds, ...updates }) => {
  // ... existing update logic ...
  
  if (updates.assignee_ids && previousAssigneeIds) {
    const newAssignees = updates.assignee_ids.filter(
      id => !previousAssigneeIds.includes(id)
    );
    if (newAssignees.length > 0) {
      // Получить title задачи из updates или из ответа
      const notifications = newAssignees.map(assigneeId => ({
        recipient_id: assigneeId,
        type: 'task_assigned',
        title: 'Вас назначили исполнителем задачи',
        body: updates.title || 'Задача обновлена',
        link: `/tasks?task=${id}`,
        related_task_id: id,
      }));
      await proxyInsert('notifications', notifications);
    }
  }
}
```

Альтернативный (более надёжный) подход — перед обновлением загружать текущую задачу через `proxySelect`, чтобы получить актуальные `assignee_ids` и `title` без необходимости передавать их извне.

## Затрагиваемые файлы
- `src/hooks/useTasks.ts` — добавить логику уведомлений в `useUpdateTask`
- Вызывающие компоненты (TasksModule и др.) — если выбран подход с `previousAssigneeIds`, нужно передавать старые значения при вызове мутации

