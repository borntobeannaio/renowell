
-- Create chat_message_reactions table
CREATE TABLE public.chat_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;

-- SELECT: conversation participants
CREATE POLICY "Participants can view reactions"
ON public.chat_message_reactions FOR SELECT
USING (
  is_conversation_participant(
    (SELECT conversation_id FROM public.chat_messages WHERE id = message_id)
  )
);

-- INSERT: conversation participants, own user_id
CREATE POLICY "Participants can add reactions"
ON public.chat_message_reactions FOR INSERT
WITH CHECK (
  user_id = get_user_profile_id()
  AND is_conversation_participant(
    (SELECT conversation_id FROM public.chat_messages WHERE id = message_id)
  )
);

-- DELETE: only own reactions
CREATE POLICY "Users can remove own reactions"
ON public.chat_message_reactions FOR DELETE
USING (user_id = get_user_profile_id());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;

-- Index for fast lookups by message
CREATE INDEX idx_chat_message_reactions_message_id ON public.chat_message_reactions(message_id);
