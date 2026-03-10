
-- Add quiet hours columns
ALTER TABLE public.notifications 
  ADD COLUMN IF NOT EXISTS send_after TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS external_sent BOOLEAN DEFAULT FALSE;

-- Replace the trigger function with quiet hours logic
CREATE OR REPLACE FUNCTION public.notify_external_channels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  msk_hour integer;
  next_9am timestamptz;
BEGIN
  -- Get current hour in Moscow time (UTC+3)
  msk_hour := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Europe/Moscow'));
  
  -- Check if we're in quiet hours: 21:00-23:59 or 00:00-08:59 MSK
  IF msk_hour >= 21 OR msk_hour < 9 THEN
    -- Calculate next 09:00 MSK
    IF msk_hour >= 21 THEN
      -- After 21:00 -> next day 09:00 MSK
      next_9am := (date_trunc('day', NOW() AT TIME ZONE 'Europe/Moscow') + INTERVAL '1 day' + INTERVAL '9 hours') AT TIME ZONE 'Europe/Moscow';
    ELSE
      -- Before 09:00 -> today 09:00 MSK
      next_9am := (date_trunc('day', NOW() AT TIME ZONE 'Europe/Moscow') + INTERVAL '9 hours') AT TIME ZONE 'Europe/Moscow';
    END IF;
    
    -- Set send_after, don't call edge function
    UPDATE public.notifications SET send_after = next_9am WHERE id = NEW.id;
    RETURN NEW;
  END IF;
  
  -- Not quiet hours: send immediately
  PERFORM net.http_post(
    url := 'https://kstfczzkskpmsswmanif.supabase.co/functions/v1/send-external-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  
  -- Mark as sent
  UPDATE public.notifications SET external_sent = true WHERE id = NEW.id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to call external notification: %', SQLERRM;
    RETURN NEW;
END;
$function$;
