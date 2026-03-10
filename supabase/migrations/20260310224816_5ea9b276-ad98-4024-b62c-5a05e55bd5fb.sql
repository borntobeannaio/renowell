
-- Add middle_name to profiles
ALTER TABLE public.profiles ADD COLUMN middle_name text DEFAULT NULL;

-- Add middle_name to employees  
ALTER TABLE public.employees ADD COLUMN middle_name text DEFAULT NULL;

-- Update sync trigger to include middle_name
CREATE OR REPLACE FUNCTION public.sync_profile_to_employee()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.employees SET 
    avatar_url = NEW.avatar_url,
    full_name = COALESCE(NULLIF(CONCAT_WS(' ', NEW.last_name, NEW.first_name), ''), 'Пользователь'),
    position = COALESCE(NEW.position, 'Сотрудник'),
    birthday = NEW.birthday,
    description = NEW.description,
    middle_name = NEW.middle_name
  WHERE profile_id = NEW.id;
  RETURN NEW;
END;
$function$;
