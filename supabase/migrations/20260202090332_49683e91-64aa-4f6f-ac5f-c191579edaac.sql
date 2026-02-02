-- Create function to sync profile changes to employees table
CREATE OR REPLACE FUNCTION public.sync_profile_to_employee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Update linked employee when profile is updated
  UPDATE public.employees
  SET 
    avatar_url = NEW.avatar_url,
    full_name = COALESCE(NULLIF(CONCAT_WS(' ', NEW.first_name, NEW.last_name), ''), 'Пользователь'),
    position = COALESCE(NEW.position, 'Сотрудник'),
    birthday = NEW.birthday
  WHERE profile_id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to sync on profile update
DROP TRIGGER IF EXISTS sync_profile_to_employee_trigger ON public.profiles;

CREATE TRIGGER sync_profile_to_employee_trigger
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_to_employee();