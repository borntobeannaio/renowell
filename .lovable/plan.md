## Исправление appId для Capacitor Android

### Проблема
В `capacitor.config.ts` указан `appId: 'app.lovable.0c20bd3b13c64401a76bdee9b432d23c'`, который содержит дефисы и не соответствует Java package naming convention. Команда `npx cap add android` падает с ошибкой.

### Решение
1. Открыть `capacitor.config.ts`.
2. Заменить `appId` на валидное значение: `com.renowell.app` (подходит под требования: два сегмента через точку, только буквы/цифры/подчёркивание, начинается с буквы).
3. Сохранить.
4. Повторить `npx cap add android`.

### Техническая деталь
Новый `appId`: `com.renowell.app` — короткий, читаемый и уникальный для вашего приложения Renowell.
