
-- Support messages table
CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_profile_id UUID NOT NULL REFERENCES public.profiles(id),
  direction TEXT NOT NULL DEFAULT 'outgoing' CHECK (direction IN ('outgoing', 'incoming')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Users can view their own support messages
CREATE POLICY "Users can view own support messages"
ON public.support_messages FOR SELECT
USING (user_profile_id = get_user_profile_id());

-- Users can insert outgoing messages only
CREATE POLICY "Users can send support messages"
ON public.support_messages FOR INSERT
WITH CHECK (user_profile_id = get_user_profile_id() AND direction = 'outgoing');

-- Index for fast lookup
CREATE INDEX idx_support_messages_user ON public.support_messages(user_profile_id, created_at);

-- Enable realtime for support messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;

-- Mapping table for Telegram reply routing (used by edge functions only)
CREATE TABLE public.support_telegram_map (
  telegram_message_id BIGINT PRIMARY KEY,
  user_profile_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No RLS needed - only accessed by edge functions with service_role_key
