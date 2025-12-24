-- Create calls table for tracking active calls
CREATE TABLE public.calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  caller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel_name TEXT NOT NULL,
  call_type TEXT NOT NULL DEFAULT 'video', -- 'video' or 'audio'
  status TEXT NOT NULL DEFAULT 'ringing', -- 'ringing', 'active', 'ended'
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create call_participants table
CREATE TABLE public.call_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE,
  left_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'invited', -- 'invited', 'joined', 'left', 'declined'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(call_id, user_id)
);

-- Enable RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;

-- Policies for calls
CREATE POLICY "Users can view calls they are part of"
ON public.calls FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.call_participants cp
    WHERE cp.call_id = id AND cp.user_id IN (
      SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  )
  OR caller_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
);

CREATE POLICY "Users can create calls"
ON public.calls FOR INSERT
WITH CHECK (
  caller_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
);

CREATE POLICY "Users can update calls they are part of"
ON public.calls FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.call_participants cp
    WHERE cp.call_id = id AND cp.user_id IN (
      SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  )
  OR caller_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- Policies for call_participants
CREATE POLICY "Users can view call participants for their calls"
ON public.call_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.calls c
    WHERE c.id = call_id AND (
      c.caller_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.call_participants cp2
        WHERE cp2.call_id = c.id AND cp2.user_id IN (
          SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
        )
      )
    )
  )
);

CREATE POLICY "Users can insert call participants"
ON public.call_participants FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.calls c
    WHERE c.id = call_id AND c.caller_id IN (
      SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update their own participation"
ON public.call_participants FOR UPDATE
USING (
  user_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- Enable realtime for calls
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_participants;