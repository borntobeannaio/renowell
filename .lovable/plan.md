

## Проблема: все пользователи видят все чаты и сообщения

### Корневая причина

Все запросы к БД идут через `dbProxy` → Yandex Cloud → `db-proxy` edge function, которая использует `SERVICE_ROLE_KEY` и **полностью обходит RLS**. При этом в `useConversations()` нет фильтра по текущему пользователю — запрос возвращает ВСЕ чаты из таблицы `chat_conversations`.

Результат: Софья видит чат Войченко с Морозом, и наоборот — все видят всё.

### Решение

Добавить фильтрацию по участнику в хуки чатов, поскольку RLS не работает через прокси:

**Файл: `src/hooks/useChat.ts`**

1. **`useConversations()`** — подгружать только те чаты, где текущий пользователь является участником:
   - Сначала получить `profile.id` текущего юзера
   - Запросить `chat_participants` с фильтром `user_id = profile.id` → список `conversation_id`
   - Запросить `chat_conversations` с фильтром `id in [conversation_ids]`

2. **`useConversationMessages()`** — добавить проверку, что текущий пользователь является участником разговора (опционально, но для безопасности)

**Файл: `src/hooks/useChat.ts` — изменения в `useConversations`:**

```typescript
export function useConversations() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // 1. Get current user's profile ID
      const { data: profiles } = await proxySelect<{ id: string }>('profiles', {
        select: 'id',
        filters: [{ column: 'user_id', operator: 'eq', value: user.id }],
        limit: 1,
      });
      const profileId = profiles?.[0]?.id;
      if (!profileId) return [];
      
      // 2. Get conversation IDs where user is a participant
      const { data: participations } = await proxySelect<{ conversation_id: string }>('chat_participants', {
        select: 'conversation_id',
        filters: [{ column: 'user_id', operator: 'eq', value: profileId }],
      });
      if (!participations?.length) return [];
      
      const convIds = participations.map(p => p.conversation_id);
      
      // 3. Fetch only those conversations
      const { data, error } = await proxySelect<ChatConversation>('chat_conversations', {
        filters: [{ column: 'id', operator: 'in', value: convIds }],
        order: [{ column: 'updated_at', ascending: false }],
      });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!user,
  });
}
```

### Масштаб
Один файл (`src/hooks/useChat.ts`), одна функция `useConversations` — добавить 2 промежуточных запроса для фильтрации по участнику.

