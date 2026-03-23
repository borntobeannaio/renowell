

## Исправление ошибки "Cannot read properties of undefined (reading 'id')" при создании протокола

### Причина

Функции `useCreateProtocol`, `useCreateTask`, `useCreateProtocolItem` возвращают `data?.[0]` — результат INSERT через db-proxy. Если прокси вернул пустой массив (транзиентная ошибка сети, таймаут, или data = null), результат будет `undefined`. Затем код обращается к `.id` на `undefined` и падает.

Три точки падения в `handleCreate`:
1. `result.id` (строка ~1398) — после `createProtocol.mutateAsync`
2. `createdItem.id` (строка ~1434) — после `createProtocolItem.mutateAsync`  
3. `taskResult.id` (строка ~1508) — после `createTask.mutateAsync`

### Решение

**Файл `src/hooks/useProtocols.ts`** — добавить проверку после каждого insert:

```typescript
// useCreateProtocol
const result = data?.[0];
if (!result) throw new Error('Сервер не вернул данные протокола');
return result;

// useCreateProtocolItem  
const result = data?.[0];
if (!result) throw new Error('Сервер не вернул данные пункта');
return result;
```

**Файл `src/hooks/useTasks.ts`** — аналогично:

```typescript
const newTask = data?.[0];
if (!newTask) throw new Error('Сервер не вернул данные задачи');
```

**Файл `src/hooks/useProtocolSections.ts`** — проверить `useCreateProtocolSection` на тот же паттерн.

Итого: 3-4 файла, добавление null-guard после каждого `data?.[0]` чтобы выбрасывать понятную ошибку вместо TypeError.

