ALTER TABLE public.tasks DROP CONSTRAINT tasks_status_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check 
  CHECK (status = ANY (ARRAY['new','in_progress','review','done','on_hold','blocked','cancelled','archived']));