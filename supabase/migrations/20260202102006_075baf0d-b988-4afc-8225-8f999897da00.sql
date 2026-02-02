-- Обновить CHECK constraint для поддержки новых типов уведомлений
ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY[
  'task_assigned',
  'deadline_week', 
  'deadline_day',
  'mention',
  'chat_message',
  'chat_created'
]));