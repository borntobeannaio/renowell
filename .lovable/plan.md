

# План: Настройки каналов уведомлений в профиле

## Обзор

Добавить в страницу профиля секцию с мультивыбором каналов доставки уведомлений:
- **Telegram** — отправка через бота
- **Email** — отправка через Resend
- **Push в браузере** — Web Push API

С пометкой: "В панели уведомлений всегда отображаются все уведомления"

---

## Изменения в базе данных

### Новые поля в таблице `profiles`

```sql
ALTER TABLE public.profiles
ADD COLUMN telegram_chat_id text,
ADD COLUMN notify_telegram boolean DEFAULT false,
ADD COLUMN notify_email boolean DEFAULT false,
ADD COLUMN notify_push boolean DEFAULT false,
ADD COLUMN push_subscription jsonb;
```

| Поле | Тип | Описание |
|------|-----|----------|
| `telegram_chat_id` | text | ID чата Telegram для отправки сообщений |
| `notify_telegram` | boolean | Включены ли Telegram-уведомления |
| `notify_email` | boolean | Включены ли Email-уведомления |
| `notify_push` | boolean | Включены ли Push-уведомления в браузере |
| `push_subscription` | jsonb | Данные подписки Web Push (endpoint, keys) |

---

## UI: Секция настроек уведомлений

Добавить в `Profile.tsx` после формы "О себе":

```text
┌─────────────────────────────────────────────────────────────────┐
│  🔔 Уведомления                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Дополнительные каналы доставки:                                │
│                                                                 │
│  [✓] 📱 Telegram                                                │
│      Статус: Не привязан                                        │
│      [Привязать Telegram]                                       │
│                                                                 │
│  [ ] 📧 Email                                                   │
│      Адрес: example@mail.ru                                     │
│                                                                 │
│  [ ] 🔔 Push-уведомления в браузере                             │
│      [Разрешить уведомления]                                    │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  ℹ️ В панели уведомлений всегда отображаются все уведомления    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Логика каждого канала

**Telegram:**
- Если `telegram_chat_id` пустой — кнопка "Привязать Telegram"
- При клике — диалог с инструкцией и кодом привязки
- Если привязан — показать "Привязан ✅" и кнопку "Отвязать"

**Email:**
- Чекбокс активен если есть email в профиле сотрудника
- Если email нет — показать подсказку "Добавьте email в HR-модуле"

**Push в браузере:**
- Если `Notification.permission === 'default'` — кнопка "Разрешить уведомления"
- Если `granted` и есть подписка — "Включены ✅"
- Если `denied` — "Заблокированы браузером"

---

## Push-уведомления: Техническая реализация

### 1. VAPID ключи

Генерация пары ключей для Web Push:
```bash
npx web-push generate-vapid-keys
```

Результат — два ключа:
- `VAPID_PUBLIC_KEY` — публичный (используется в клиенте)
- `VAPID_PRIVATE_KEY` — приватный (секрет для Edge Function)

Публичный ключ можно хранить в коде (он безопасен).
Приватный — в секретах Lovable Cloud.

### 2. Service Worker

Создать `public/sw.js` для обработки push-событий:

```javascript
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'Новое уведомление';
  const options = {
    body: data.body || '',
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: { url: data.url || '/' }
  };
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.openWindow(url)
  );
});
```

### 3. Подписка на Push

Хук `usePushNotifications.ts`:

```typescript
export function usePushNotifications() {
  const subscribeToush = async () => {
    // 1. Регистрация service worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    
    // 2. Запрос разрешения
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    
    // 3. Подписка на push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID_PUBLIC_KEY
    });
    
    // 4. Сохранение подписки в профиле
    await proxyUpdate('profiles', {
      notify_push: true,
      push_subscription: subscription.toJSON()
    }, [...]);
    
    return subscription;
  };
  
  return { subscribeToPush, ... };
}
```

### 4. Отправка Push (Edge Function)

В `send-external-notification` добавить отправку Web Push:

```typescript
import webpush from 'npm:web-push';

webpush.setVapidDetails(
  'mailto:support@renowell.ru',
  Deno.env.get('VAPID_PUBLIC_KEY'),
  Deno.env.get('VAPID_PRIVATE_KEY')
);

if (profile.notify_push && profile.push_subscription) {
  await webpush.sendNotification(
    profile.push_subscription,
    JSON.stringify({ title, body, url })
  );
}
```

---

## Файлы

### Новые файлы

| Файл | Описание |
|------|----------|
| `public/sw.js` | Service Worker для Push-уведомлений |
| `src/components/settings/NotificationSettings.tsx` | Секция настроек уведомлений |
| `src/components/settings/TelegramLinkDialog.tsx` | Диалог привязки Telegram |
| `src/hooks/usePushNotifications.ts` | Хук для работы с Web Push |
| `supabase/functions/send-external-notification/index.ts` | Отправка Email/Telegram/Push |
| `supabase/functions/telegram-webhook/index.ts` | Webhook для привязки Telegram |

### Изменяемые файлы

| Файл | Изменения |
|------|-----------|
| `src/pages/Profile.tsx` | Добавить компонент NotificationSettings |
| `supabase/config.toml` | Настройки для новых Edge Functions |

---

## Требования от вас

Для полной реализации потребуется:

1. **Для Email**: 
   - Зарегистрироваться на [Resend.com](https://resend.com)
   - Подтвердить домен
   - Добавить `RESEND_API_KEY` в секреты

2. **Для Push**:
   - Сгенерировать VAPID ключи (я могу сделать это автоматически)
   - Добавить `VAPID_PRIVATE_KEY` в секреты (публичный ключ будет в коде)

3. **Для Telegram**:
   - `TELEGRAM_BOT_TOKEN` уже есть ✅
   - Настроить webhook URL для бота

---

## Этапы реализации

1. **Миграция БД** — добавить поля в profiles
2. **UI компонент** — NotificationSettings с тремя каналами
3. **Push-уведомления** — Service Worker + хук подписки
4. **Edge Function** — единая функция отправки во все каналы
5. **Telegram привязка** — диалог + webhook

---

## Следующий шаг

После одобрения плана:
1. Я добавлю миграцию для новых полей
2. Создам UI-компоненты настроек
3. Реализую Push-уведомления (потребуется добавить VAPID ключи)
4. Интегрирую Email (после добавления Resend API key)
5. Настрою Telegram webhook

