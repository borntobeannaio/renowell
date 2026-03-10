
-- Add first_name, last_name to employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS first_name text DEFAULT NULL;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS last_name text DEFAULT NULL;

-- Populate from full_name (format: "Фамилия Имя [Отчество]")
UPDATE public.employees SET
  last_name = split_part(full_name, ' ', 1),
  first_name = CASE 
    WHEN array_length(string_to_array(full_name, ' '), 1) >= 2 
    THEN split_part(full_name, ' ', 2)
    ELSE NULL
  END
WHERE first_name IS NULL AND last_name IS NULL;

-- Update sync trigger to include first_name, last_name
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
    first_name = NEW.first_name,
    last_name = NEW.last_name,
    middle_name = NEW.middle_name,
    position = COALESCE(NEW.position, 'Сотрудник'),
    birthday = NEW.birthday,
    description = NEW.description
  WHERE profile_id = NEW.id;
  RETURN NEW;
END;
$function$;
