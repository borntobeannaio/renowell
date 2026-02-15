
-- Create calendar_events table
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  is_online BOOLEAN NOT NULL DEFAULT false,
  creator_id UUID NOT NULL REFERENCES public.profiles(id),
  participant_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view events
CREATE POLICY "Authenticated users can view calendar_events"
  ON public.calendar_events FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Creator can insert
CREATE POLICY "Authenticated users can insert calendar_events"
  ON public.calendar_events FOR INSERT
  WITH CHECK (creator_id = public.get_user_profile_id());

-- Creator can update
CREATE POLICY "Creator can update calendar_events"
  ON public.calendar_events FOR UPDATE
  USING (creator_id = public.get_user_profile_id());

-- Creator can delete
CREATE POLICY "Creator can delete calendar_events"
  ON public.calendar_events FOR DELETE
  USING (creator_id = public.get_user_profile_id());

-- Trigger for updated_at
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
