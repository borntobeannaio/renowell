
-- Trigger: save snapshot before updating draft data
CREATE TRIGGER trg_save_draft_snapshot
  BEFORE UPDATE ON public.form_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.save_draft_snapshot();

-- Trigger: cleanup old snapshots after new one is inserted
CREATE TRIGGER trg_cleanup_old_snapshots
  AFTER INSERT ON public.form_draft_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_old_snapshots();
