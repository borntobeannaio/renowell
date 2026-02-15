
-- Add ICS URL to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ics_url text;

-- Add source and external_uid to calendar_events
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'internal';
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS external_uid text;

-- Unique index to prevent duplicate external events per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_creator_external_uid 
ON public.calendar_events (creator_id, external_uid) 
WHERE external_uid IS NOT NULL;
