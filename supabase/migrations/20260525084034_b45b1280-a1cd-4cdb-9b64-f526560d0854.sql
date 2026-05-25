
-- 1. Add participant_ids to protocols for construction protocols access control
ALTER TABLE public.protocols ADD COLUMN IF NOT EXISTS participant_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

-- 2. Create employee_notes table
CREATE TABLE IF NOT EXISTS public.employee_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id uuid NOT NULL,
  visibility text NOT NULL CHECK (visibility IN ('private','work')),
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_notes_owner ON public.employee_notes(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_employee_notes_visibility ON public.employee_notes(visibility);

ALTER TABLE public.employee_notes ENABLE ROW LEVEL SECURITY;

-- SELECT: private only by owner, work by everyone authenticated
CREATE POLICY "Owner can view own private notes"
  ON public.employee_notes
  FOR SELECT
  USING (
    (visibility = 'private' AND owner_profile_id = public.get_user_profile_id())
    OR (visibility = 'work' AND auth.uid() IS NOT NULL)
  );

CREATE POLICY "Owner can insert own notes"
  ON public.employee_notes
  FOR INSERT
  WITH CHECK (owner_profile_id = public.get_user_profile_id());

CREATE POLICY "Owner can update own notes"
  ON public.employee_notes
  FOR UPDATE
  USING (owner_profile_id = public.get_user_profile_id());

CREATE POLICY "Owner can delete own notes"
  ON public.employee_notes
  FOR DELETE
  USING (owner_profile_id = public.get_user_profile_id());

CREATE TRIGGER trg_employee_notes_updated_at
  BEFORE UPDATE ON public.employee_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
