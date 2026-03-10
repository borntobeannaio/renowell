

# Тихие часы для уведомлений (21:00–09:00 МСК)

## Суть
Уведомления, приходящие с 21:00 до 09:00 по Москве, не отправляются сразу во внешние каналы (Telegram, Email), а копятся и отправляются в 9:00 МСК.

In-app уведомления (в панели колокольчика) по-прежнему появляются сразу — откладывается только внешняя доставка.

## Изменения

### 1. Новый столбец `send_after` в таблице `notifications`
- `send_after TIMESTAMPTZ DEFAULT NULL` — если NULL, отправляем сразу; если заполнено — ждём до указанного времени.
- `external_sent BOOLEAN DEFAULT FALSE` — флаг, что внешняя доставка выполнена.

### 2. Обновить триггер `notify_external_channels()`
Проверяем текущее время по МСК (UTC+3). Если сейчас тихие часы (21:00–09:00):
- Записываем `send_after = следующие 09:00 МСК` в строку уведомления.
- **Не** вызываем edge function.

Если не тихие часы — вызываем edge function как раньше и ставим `external_sent = true`.

### 3. Новый cron job `send-queued-notifications`
Запускается ежедневно в 06:00 UTC (= 09:00 МСК). Выбирает все записи с `send_after <= NOW() AND external_sent = false`, вызывает `send-external-notification` для каждой, помечает `external_sent = true`.

### 4. Edge function `send-queued-notifications`
Простая функция: выбирает отложенные уведомления, вызывает существующую `send-external-notification` для каждого, обновляет флаг.

## Что НЕ меняется
- In-app уведомления (NotificationBell) — всегда мгновенно.
- Realtime подписка — без изменений.
- Логика `send-external-notification` — без изменений.

