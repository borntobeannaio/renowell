CREATE TRIGGER audit_tasks
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();