-- Add notification settings fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS telegram_chat_id text,
ADD COLUMN IF NOT EXISTS notify_telegram boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notify_email boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notify_push boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS push_subscription jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.telegram_chat_id IS 'Telegram chat ID for sending notifications';
COMMENT ON COLUMN public.profiles.notify_telegram IS 'Whether Telegram notifications are enabled';
COMMENT ON COLUMN public.profiles.notify_email IS 'Whether Email notifications are enabled';
COMMENT ON COLUMN public.profiles.notify_push IS 'Whether browser Push notifications are enabled';
COMMENT ON COLUMN public.profiles.push_subscription IS 'Web Push subscription data (endpoint, keys)';