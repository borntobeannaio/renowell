-- Drop existing check constraint on status
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Add priority column to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal';

-- Update existing status values to new format
UPDATE public.tasks SET status = 'new' WHERE status = 'inbox';
UPDATE public.tasks SET status = 'in_progress' WHERE status = 'doing';

-- Add new check constraint with updated status values
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check 
CHECK (status IN ('new', 'in_progress', 'review', 'done', 'on_hold', 'blocked', 'cancelled'));

-- Add check constraint for priority
ALTER TABLE public.tasks ADD CONSTRAINT tasks_priority_check 
CHECK (priority IN ('critical', 'high', 'normal', 'low'));

-- Set default priority for existing tasks
UPDATE public.tasks SET priority = 'normal' WHERE priority IS NULL;