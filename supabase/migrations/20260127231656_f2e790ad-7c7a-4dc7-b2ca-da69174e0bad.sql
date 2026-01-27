-- Enable the pg_net extension for HTTP calls from database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to call external notification edge function
CREATE OR REPLACE FUNCTION public.notify_external_channels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Call the edge function to send external notifications
  PERFORM net.http_post(
    url := 'https://kstfczzkskpmsswmanif.supabase.co/functions/v1/send-external-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Failed to call external notification: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger to call the function after notification insert
DROP TRIGGER IF EXISTS after_notification_insert ON public.notifications;
CREATE TRIGGER after_notification_insert
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_external_channels();