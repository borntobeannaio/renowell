
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS organizer TEXT,
  ADD COLUMN IF NOT EXISTS attendees JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS url TEXT,
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
