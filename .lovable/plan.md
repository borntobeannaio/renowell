

## Исправление дропдауна участников в модалке создания встречи

### Корневая причина

`stopPropagation` на контейнере дропдауна не помогает, потому что Radix Dialog использует **другой механизм**: он слушает `pointerdown` на `document` и проверяет, находится ли цель клика **внутри DOM-дерева `DialogContent`**. Поскольку портал рендерится в `document.body` (вне `DialogContent`), Radix всегда считает это кликом снаружи и закрывает диалог.

### Решение

В `CreateEventModal.tsx` добавить обработчик `onInteractOutside` на `DialogContent`, который проверяет, был ли клик внутри элемента с атрибутом `[data-employee-dropdown]`. Если да — отменять закрытие (`event.preventDefault()`).

### Изменения

**Файл: `src/components/modules/calendar/CreateEventModal.tsx`**

На компоненте `DialogContent` добавить:

```tsx
<DialogContent
  className="max-w-md"
  onInteractOutside={(e) => {
    const target = e.target as HTMLElement;
    if (target?.closest?.("[data-employee-dropdown]")) {
      e.preventDefault();
    }
  }}
>
```

Это единственное изменение. `stopPropagation` в `EmployeeMultiSelect` можно оставить — он не мешает и полезен для других случаев.

### Почему это сработает

- Radix Dialog вызывает `onInteractOutside` перед закрытием
- `e.preventDefault()` отменяет закрытие диалога
- Проверка `closest("[data-employee-dropdown]")` гарантирует, что отменяем только для дропдауна, а не для любого клика снаружи

### Файлы

1. `src/components/modules/calendar/CreateEventModal.tsx` — добавить `onInteractOutside` на `DialogContent`

