-- Add multi-select fields for assignees, responsibles, and observers
ALTER TABLE public.tasks 
  ADD COLUMN assignee_ids uuid[] DEFAULT '{}',
  ADD COLUMN responsible_ids uuid[] DEFAULT '{}',
  ADD COLUMN observer_ids uuid[] DEFAULT '{}';

-- Migrate existing assignee_id data to assignee_ids array
UPDATE public.tasks 
SET assignee_ids = ARRAY[assignee_id]
WHERE assignee_id IS NOT NULL;