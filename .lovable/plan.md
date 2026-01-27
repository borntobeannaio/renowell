

# План: Система уведомлений с тегированием (через Yandex прокси)

## Обзор

Создание системы уведомлений и @mentions в комментариях. **Все операции с базой данных будут проходить через Yandex Cloud прокси** (`proxySelect`, `proxyInsert`, `proxyUpdate`, `proxyDelete`) для обхода блокировок.

---

## Предварительное исправление

Перед реализацией новой функциональности нужно **переключить `useTaskComments.ts` на dbProxy**, так как сейчас он использует прямой Supabase клиент.

---

## Этап 1: База данных (миграции)

### Таблица `notifications`

```sql
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('task_assigned', 'deadline_week', 'deadline_day', 'mention')),
  title text NOT NULL,
  body text NOT NULL,
  link text,
  related_task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: пользователь видит только свои уведомления
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (recipient_id = get_user_profile_id());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (recipient_id = get_user_profile_id());

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (recipient_id = get_user_profile_id());

-- Insert только через service role (edge functions)
CREATE POLICY "Service can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);
```

### Таблица `comment_mentions`

```sql
CREATE TABLE public.comment_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.task_comments(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comment_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view mentions"
  ON public.comment_mentions FOR SELECT
  USING (true);

CREATE POLICY "Service can insert mentions"
  ON public.comment_mentions FOR INSERT
  WITH CHECK (true);
```

### Realtime для уведомлений

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
```

---

## Этап 2: Переключение useTaskComments на dbProxy

### Изменения в `src/hooks/useTaskComments.ts`

Заменить все прямые вызовы Supabase на прокси:

| Было | Станет |
|------|--------|
| `supabase.from("task_comments").select(...)` | `proxySelect("task_comments", { select: "*, author:profiles!..." })` |
| `supabase.from("task_comments").insert(...)` | `proxyInsert("task_comments", {...}, "*, author:profiles!...")` |
| `supabase.from("task_comments").delete(...)` | `proxyDelete("task_comments", filters)` |
| `supabase.rpc("get_user_profile_id")` | Кэшировать profile_id через контекст или отдельный хук |

**Проблема**: `get_user_profile_id()` — это RPC вызов. Нужно добавить поддержку RPC в db-proxy или использовать альтернативу.

**Решение**: Сохранять `profile_id` в контексте при загрузке профиля пользователя (Profile.tsx/Sidebar.tsx уже загружает профиль). Создать `useCurrentProfile` хук.

---

## Этап 3: Новый хук useCurrentProfile

Создать хук для получения текущего профиля пользователя (с кэшированием):

```typescript
// src/hooks/useCurrentProfile.ts
export function useCurrentProfile() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['current-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await proxySelect<Profile>('profiles', {
        filters: [{ column: 'user_id', operator: 'eq', value: user!.id }],
        limit: 1,
      });
      if (error) throw new Error(error.message);
      return data?.[0] ?? null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Кэш 5 минут
  });
}
```

---

## Этап 4: Хук useNotifications

```typescript
// src/hooks/useNotifications.ts
export function useNotifications() {
  const { data: profile } = useCurrentProfile();
  
  return useQuery({
    queryKey: ['notifications', profile?.id],
    queryFn: async () => {
      const { data, error } = await proxySelect<Notification>('notifications', {
        filters: [{ column: 'recipient_id', operator: 'eq', value: profile!.id }],
        order: [{ column: 'created_at', ascending: false }],
        limit: 50,
      });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!profile?.id,
  });
}

export function useMarkNotificationRead() {
  return useMutation({
    mutationFn: async (id: string) => {
      await proxyUpdate('notifications', { is_read: true }, 
        [{ column: 'id', operator: 'eq', value: id }]);
    },
    // + invalidate queries
  });
}

export function useMarkAllRead() {
  return useMutation({
    mutationFn: async (profileId: string) => {
      await proxyUpdate('notifications', { is_read: true },
        [{ column: 'recipient_id', operator: 'eq', value: profileId },
         { column: 'is_read', operator: 'eq', value: false }]);
    },
  });
}
```

---

## Этап 5: Компоненты UI

### NotificationBell (в Header)

```text
+------------------------------------------+
| [Logo]  Заголовок   [🔔(3)]  [🔍] [Выход] |
+------------------------------------------+
```

При клике — dropdown с уведомлениями:
- Иконка по типу (задача/дедлайн/упоминание)
- Заголовок + время
- Непрочитанные выделены
- Кнопка "Прочитать все"

### MentionInput (в комментариях)

Компонент поля ввода с поддержкой `@`:
1. При вводе `@` — показать dropdown со списком сотрудников
2. Фильтрация по имени
3. Выбор вставляет `@Имя Фамилия`
4. При отправке — парсинг упоминаний

---

## Этап 6: Edge Function для дедлайнов

```typescript
// supabase/functions/deadline-notifications/index.ts
// Запускается ежедневно по cron

// 1. Найти задачи с due_date = today + 7 дней
// 2. Создать уведомления deadline_week (если ещё не созданы)
// 3. Найти задачи с due_date = today + 1 день
// 4. Создать уведомления deadline_day
```

Cron настройка (через SQL после деплоя):
```sql
SELECT cron.schedule(
  'deadline-notifications-daily',
  '0 8 * * *',  -- Ежедневно в 8:00 UTC (11:00 МСК)
  $$SELECT net.http_post(...)$$
);
```

---

## Этап 7: Генерация уведомлений

### При создании задачи с assignee_id

В `useCreateTask` добавить вызов:
```typescript
if (task.assignee_id) {
  await proxyInsert('notifications', {
    recipient_id: task.assignee_id,
    type: 'task_assigned',
    title: 'Новая задача',
    body: task.title,
    related_task_id: newTask.id,
  });
}
```

### При создании комментария с упоминаниями

В `useCreateTaskComment`:
1. Парсинг `@Имя Фамилия` из текста
2. Поиск profile_id по full_name в employees
3. Создание записей в `comment_mentions`
4. Создание уведомлений `mention`

---

## Файлы

### Новые файлы

| Файл | Описание |
|------|----------|
| `src/hooks/useCurrentProfile.ts` | Хук для текущего профиля с кэшированием |
| `src/hooks/useNotifications.ts` | Хук для работы с уведомлениями |
| `src/components/notifications/NotificationBell.tsx` | Колокольчик в хедере |
| `src/components/notifications/NotificationItem.tsx` | Элемент уведомления |
| `src/components/tasks/MentionInput.tsx` | Input с @mentions |
| `supabase/functions/deadline-notifications/index.ts` | Cron для дедлайнов |

### Изменяемые файлы

| Файл | Изменения |
|------|-----------|
| `src/hooks/useTaskComments.ts` | Переключение на dbProxy |
| `src/hooks/useTasks.ts` | Добавить генерацию уведомлений при создании задачи |
| `src/components/layout/Header.tsx` | Добавить NotificationBell |
| `src/components/tasks/TaskComments.tsx` | Интегрировать MentionInput |
| `supabase/config.toml` | Настройка verify_jwt для deadline-notifications |

---

## Важно: Яндекс прокси

Все database операции используют функции из `@/lib/dbProxy`:
- `proxySelect` — чтение
- `proxyInsert` — создание
- `proxyUpdate` — обновление
- `proxyDelete` — удаление

**Яндекс Cloud функция изменений НЕ требует** — она уже передаёт запросы в db-proxy edge function, который поддерживает relation-запросы через параметр `select`.

**Единственное ограничение**: RPC вызовы (`supabase.rpc("get_user_profile_id")`) не поддерживаются через прокси. Решение — использовать `useCurrentProfile` хук с кэшированием profile_id.

