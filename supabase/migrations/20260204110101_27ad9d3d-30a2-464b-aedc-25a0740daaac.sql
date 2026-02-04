-- Добавить колонку для вложений в уведомления
ALTER TABLE notifications 
ADD COLUMN attachments jsonb DEFAULT NULL;

-- Добавить комментарий
COMMENT ON COLUMN notifications.attachments IS 
  'Массив вложений [{url, fileName, contentType, size}]';