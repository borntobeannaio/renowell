ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS description text;

CREATE OR REPLACE FUNCTION public.sync_profile_to_employee()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.employees SET 
    avatar_url = NEW.avatar_url,
    full_name = COALESCE(NULLIF(CONCAT_WS(' ', NEW.first_name, NEW.last_name), ''), 'Пользователь'),
    position = COALESCE(NEW.position, 'Сотрудник'),
    birthday = NEW.birthday,
    description = NEW.description
  WHERE profile_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
CREATE TRIGGER on_profile_updated
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_employee();