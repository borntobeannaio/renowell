-- Fix chat_participants RLS policies (infinite recursion)
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.chat_participants;

CREATE POLICY "Users can view participants of their conversations"
ON public.chat_participants FOR SELECT
USING (
  conversation_id IN (
    SELECT conversation_id FROM public.chat_participants WHERE user_id = auth.uid()
  )
);

-- Fix chat_conversations RLS policy
DROP POLICY IF EXISTS "Users can view their conversations" ON public.chat_conversations;

CREATE POLICY "Users can view their conversations"
ON public.chat_conversations FOR SELECT
USING (
  id IN (
    SELECT conversation_id FROM public.chat_participants WHERE user_id = auth.uid()
  )
  OR created_by = auth.uid()
);

-- Fix chat_messages RLS policies
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.chat_messages;

CREATE POLICY "Users can view messages in their conversations"
ON public.chat_messages FOR SELECT
USING (
  conversation_id IN (
    SELECT conversation_id FROM public.chat_participants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can send messages to their conversations"
ON public.chat_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() 
  AND conversation_id IN (
    SELECT conversation_id FROM public.chat_participants WHERE user_id = auth.uid()
  )
);

-- Fix call_participants RLS policies (infinite recursion)
DROP POLICY IF EXISTS "Users can view call participants for their calls" ON public.call_participants;

CREATE POLICY "Users can view call participants for their calls"
ON public.call_participants FOR SELECT
USING (
  call_id IN (
    SELECT id FROM public.calls WHERE caller_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  OR user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- Fix calls RLS policies
DROP POLICY IF EXISTS "Users can view calls they are part of" ON public.calls;
DROP POLICY IF EXISTS "Users can update calls they are part of" ON public.calls;

CREATE POLICY "Users can view calls they are part of"
ON public.calls FOR SELECT
USING (
  caller_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR id IN (
    SELECT call_id FROM public.call_participants 
    WHERE user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Users can update calls they are part of"
ON public.calls FOR UPDATE
USING (
  caller_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR id IN (
    SELECT call_id FROM public.call_participants 
    WHERE user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);