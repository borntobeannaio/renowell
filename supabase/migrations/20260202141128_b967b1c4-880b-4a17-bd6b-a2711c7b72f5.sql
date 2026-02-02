-- Table to track when user last read each conversation
CREATE TABLE public.chat_read_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Enable RLS
ALTER TABLE public.chat_read_status ENABLE ROW LEVEL SECURITY;

-- Users can only see their own read status
CREATE POLICY "Users can view own read status"
  ON public.chat_read_status
  FOR SELECT
  USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Users can insert their own read status
CREATE POLICY "Users can insert own read status"
  ON public.chat_read_status
  FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Users can update their own read status
CREATE POLICY "Users can update own read status"
  ON public.chat_read_status
  FOR UPDATE
  USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Index for faster lookups
CREATE INDEX idx_chat_read_status_user ON public.chat_read_status(user_id);
CREATE INDEX idx_chat_read_status_conversation ON public.chat_read_status(conversation_id);

-- Enable realtime for chat_messages (for sound notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;