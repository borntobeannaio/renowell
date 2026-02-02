
# План: Исправление отображения данных в списке протоколов

## Обнаруженные проблемы

1. **Неактуальные данные**: Редактор открывается в отдельной вкладке, и изменения не синхронизируются с исходной вкладкой списка
2. **Комментарии не отображаются**: Компонент просмотра пункта протокола не загружает и не показывает комментарии

---

## Решение

### Часть 1: Обновление данных при возврате к списку

Добавим автоматическое обновление кэша при получении фокуса окна:

```text
+------------------+     открытие      +------------------+
|  Список          |  =============>  |  Редактор        |
|  протоколов      |                   |  (новая вкладка) |
|  (stale data)    |                   |  mutate + save   |
+--------+---------+                   +------------------+
         |                                      |
         |  <-- при focus -->                   |
         v                                      v
+------------------+                   
|  invalidateQueries                   
|  refetch all     |                   
+------------------+                   
```

**Изменения:**
- В `useProtocols()` и `useProtocolItems()` включить `refetchOnWindowFocus: true`
- Это переопределит глобальную настройку `refetchOnWindowFocus: false` для этих критических запросов
- При возврате к вкладке со списком данные автоматически обновятся

### Часть 2: Отображение комментариев в списке

Добавим загрузку и показ комментариев в компоненте `ProtocolItemView`:

**Изменения:**
1. Использовать `useProtocolItemComments(itemId)` для загрузки комментариев для каждого пункта при раскрытии протокола
2. Добавить отображение комментариев в `ProtocolItemView`

---

## Технические детали

### Файл 1: `src/hooks/useProtocols.ts`

Добавить `refetchOnWindowFocus: true` в хуки:

```typescript
export function useProtocols() {
  return useQuery({
    queryKey: ["protocols"],
    queryFn: async () => { ... },
    retry: 2,
    retryDelay: ...,
    refetchOnWindowFocus: true,  // <-- добавить
  });
}

export function useProtocolItems(protocolId: string | null) {
  return useQuery({
    queryKey: ["protocol_items", protocolId],
    queryFn: async () => { ... },
    enabled: !!protocolId,
    retry: 2,
    retryDelay: ...,
    refetchOnWindowFocus: true,  // <-- добавить
  });
}
```

### Файл 2: `src/hooks/useProtocolSections.ts`

Добавить `refetchOnWindowFocus: true`:

```typescript
export function useProtocolSections(protocolId: string | null) {
  return useQuery({
    queryKey: ["protocol_sections", protocolId],
    queryFn: async () => { ... },
    enabled: !!protocolId,
    retry: 2,
    retryDelay: ...,
    refetchOnWindowFocus: true,  // <-- добавить
  });
}
```

### Файл 3: `src/components/modules/ProtocolsModule.tsx`

1. **Обновить `ProtocolCard`** - загружать комментарии при раскрытии:

```typescript
import { useProtocolItemComments } from "@/hooks/useProtocolItemComments";

// Внутри ProtocolCard, после items:
const [itemComments, setItemComments] = useState<Record<string, Array<{...}>>>({});

// При раскрытии загружать комментарии для всех items
useEffect(() => {
  if (isExpanded && items.length > 0) {
    const loadComments = async () => {
      const itemIds = items.filter(i => !i.id.startsWith("temp-")).map(i => i.id);
      if (itemIds.length === 0) return;
      
      const { data: comments } = await proxySelect('protocol_item_comments', {
        filters: [{ column: 'item_id', operator: 'in', value: itemIds }],
        order: [{ column: 'created_at', ascending: true }],
      });
      
      // Группировать по item_id
      const grouped = {};
      comments?.forEach(c => {
        if (!grouped[c.item_id]) grouped[c.item_id] = [];
        grouped[c.item_id].push(c);
      });
      setItemComments(grouped);
    };
    loadComments();
  }
}, [isExpanded, items]);
```

2. **Обновить `ProtocolItemView`** - показывать комментарии:

```typescript
function ProtocolItemView({ item, comments = [] }: ProtocolItemViewProps & { comments?: Array<...> }) {
  return (
    <div className="p-3 bg-secondary/50 rounded-lg">
      <p className="text-foreground">{item.item_text}</p>
      {/* ... существующие поля ... */}
      
      {/* Комментарии */}
      {comments.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
          <span className="text-xs text-muted-foreground">
            Комментарии ({comments.length}):
          </span>
          {comments.map(comment => (
            <div key={comment.id} className="text-sm text-muted-foreground">
              <span className="font-medium">{comment.author_name}</span>: {comment.content}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Порядок выполнения

1. Обновить `useProtocols.ts` - добавить `refetchOnWindowFocus: true`
2. Обновить `useProtocolSections.ts` - добавить `refetchOnWindowFocus: true`  
3. Обновить `ProtocolsModule.tsx`:
   - Добавить загрузку комментариев в `ProtocolCard`
   - Загрузить профили авторов для имён
   - Обновить `ProtocolItemView` для показа комментариев

---

## Ожидаемый результат

- При возврате к вкладке со списком протоколов данные автоматически обновятся
- Комментарии к пунктам будут видны при раскрытии протокола в списке
- Задержка обновления составит ~200-500мс (сетевой запрос)
