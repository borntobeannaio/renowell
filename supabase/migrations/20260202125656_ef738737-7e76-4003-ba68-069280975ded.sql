-- Add archived column to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Add index for filtering active projects
CREATE INDEX IF NOT EXISTS idx_projects_archived ON public.projects(archived);

-- Add RLS policy for updating projects (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'projects' 
    AND policyname = 'Authenticated users can update projects'
  ) THEN
    CREATE POLICY "Authenticated users can update projects" 
    ON public.projects 
    FOR UPDATE 
    USING (true);
  END IF;
END $$;