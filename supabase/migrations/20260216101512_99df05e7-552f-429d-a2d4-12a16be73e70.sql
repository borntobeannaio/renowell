-- Drop the partial unique index
DROP INDEX IF EXISTS idx_calendar_events_creator_external_uid;

-- Create a proper unique constraint for upsert support
ALTER TABLE public.calendar_events ADD CONSTRAINT uq_calendar_events_creator_external_uid UNIQUE (creator_id, external_uid);