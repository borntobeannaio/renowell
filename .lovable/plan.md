

# Места, где не используется Яндекс прокси

## Результаты анализа

### 1. `src/components/chat/FloatingChat.tsx` — 3 прямых запроса к БД
- **Строка ~84**: `supabase.from("profiles").select(...)` — загрузка профилей
- **Строка ~363**: `supabase.from("chat_participants").select("user_id")` — участники беседы
- **Строка ~377**: `supabase.from("chat_participants").select(...)` с join на profiles

Нужно заменить на `proxySelect`.

### 2. `src/lib/api.ts` — 2 проблемных места
- **`invokeEdgeFunction()`** (строка ~182): вызывает `supabase.functions.invoke()` напрямую. Нужно заменить на `proxyEdgeFunction` из `mediaProxy.ts`.
- **`testConnection()`** (строка ~202): `supabase.from('profiles').select('id')` — тест соединения идёт мимо прокси. Заменить на `proxySelect` или `proxyPing`.

### 3. `src/components/modules/HRModule.tsx` — вызов edge function
- **Строка ~105**: `supabase.functions.invoke("delete-employee")` — удаление сотрудника напрямую. Заменить на `proxyEdgeFunction`.

### 4. `src/hooks/useCalendarEvents.ts` — 3 вызова edge functions
- **Строка ~94**: `supabase.functions.invoke("send-calendar-invite")` — отправка приглашения
- **Строка ~149**: то же при обновлении события
- **Строка ~182**: `supabase.functions.invoke("sync-ics-calendar")` — синхронизация календарей

Все три заменить на `proxyEdgeFunction`.

### Что НЕ нужно менять (работает корректно)
- **`supabase.auth.*`** — авторизация должна идти напрямую
- **`supabase.channel()` / `supabase.removeChannel()`** — Realtime подписки работают через WebSocket, прокси не нужен
- **Все хуки** (`useChat`, `useTasks`, `useEmployees`, `useNotifications`, `DocsTab` и т.д.) — уже используют `proxySelect` / `proxyInsert` / `proxyUpdate` / `proxyDelete`
- **Медиа** (`PhotoGallery`, `TelegramFeed`) — уже используют `proxyEdgeFunction`

## План исправлений

1. **FloatingChat.tsx**: заменить 3 вызова `supabase.from()` на `proxySelect`
2. **api.ts**: заменить `testConnection` на `proxyPing`, `invokeEdgeFunction` на `proxyEdgeFunction`
3. **HRModule.tsx**: заменить `supabase.functions.invoke("delete-employee")` на `proxyEdgeFunction`
4. **useCalendarEvents.ts**: заменить 3 вызова `supabase.functions.invoke` на `proxyEdgeFunction`

Итого: **9 прямых вызовов** в 4 файлах нужно перевести на Яндекс прокси.

