## План: Нативное приложение через Capacitor

Превращаем портал Renowell в настоящее мобильное приложение для iOS и Android, которое можно опубликовать в App Store и Google Play.

### Что я сделаю в проекте

1. **Установлю зависимости Capacitor**
   - `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`
   - `@capacitor/push-notifications` — для нативных push (у вас уже есть web-push, добавим нативный канал)
   - `@capacitor/app`, `@capacitor/status-bar`, `@capacitor/splash-screen` — базовый UX
   - `@capacitor/keyboard` — корректное поведение клавиатуры в формах

2. **Создам `capacitor.config.ts`** в корне:
   - `appId`: `app.lovable.0c20bd3b13c64401a76bdee9b432d23c`
   - `appName`: `Renowell`
   - `webDir`: `dist`
   - Hot-reload с sandbox URL — чтобы вы могли тестировать на реальном устройстве, а изменения из Lovable сразу прилетали в приложение

3. **Адаптация под мобильные нюансы**
   - Безопасные зоны (notch / Dynamic Island) — добавлю `viewport-fit=cover` и CSS `env(safe-area-inset-*)` в `index.html` и `MobileNav` (сейчас уже есть `safe-area-pb`, проверю остальные экраны)
   - Статус-бар: настрою цвет под ваш `theme-color` `#6366f1`
   - Splash-screen с логотипом Renowell
   - Отключу контекстное меню/выделение текста там, где это мешает (в чате — оставлю)

4. **Push-уведомления (нативные)**
   - Сейчас работает Web Push через VAPID и `sw.js` — на iOS-приложениях это не работает, нужен APNs
   - Добавлю слой `useNativePushNotifications`, который на платформе `ios`/`android` использует `@capacitor/push-notifications` и сохраняет нативный токен в `profiles.push_subscription` (или новое поле `native_push_token` — уточним при реализации)
   - Web остаётся как был
   - Edge function `send-queued-notifications` нужно будет научить отправлять в FCM/APNs — это второй шаг, сделаю заглушку и отмечу TODO

5. **Иконки и splash**
   - Сгенерирую иконки и splash из `renowell-logo` под все размеры iOS/Android

### Что вам нужно будет сделать на своей стороне

Capacitor нельзя собрать прямо в Lovable — нативные сборки требуют Xcode (iOS) и/или Android Studio. Я подготовлю пошаговую инструкцию, краткая версия:

1. Экспортировать проект в GitHub (кнопка справа сверху)
2. `git pull` к себе локально → `npm install`
3. `npx cap add ios` и/или `npx cap add android`
4. `npm run build && npx cap sync`
5. `npx cap run ios` (нужен Mac + Xcode) или `npx cap run android` (Android Studio)

Каждый раз после изменений в Lovable: `git pull && npm run build && npx cap sync`.

Для публикации:
- **App Store**: Apple Developer аккаунт ($99/год)
- **Google Play**: Google Play Console ($25 разово)

### Технические детали

- Hot-reload сервер в `capacitor.config.ts` указывает на `https://0c20bd3b-13c6-4401-a76b-dee9b432d23c.lovableproject.com?forceHideBadge=true` — удобно для разработки, перед публикацией в сторы это поле убираем, чтобы приложение использовало bundled `dist/`
- Авторизация через Supabase будет работать сразу (email/пароль). Для Google Sign-In в нативном приложении понадобится отдельный шаг настройки Google OAuth с native client ID — сделаем при необходимости отдельной задачей
- Web-версия портала продолжит работать без изменений, мобильное приложение использует тот же бэкенд (Lovable Cloud)

### Что НЕ входит в этот шаг

- Реальная отправка APNs/FCM с бэкенда (нужны ключи Apple/Google — сделаем после первой сборки)
- Публикация в сторы (требует ваших аккаунтов разработчика)
- Native Google Sign-In (по запросу, отдельным шагом)

После аппрува — приступаю к коду.