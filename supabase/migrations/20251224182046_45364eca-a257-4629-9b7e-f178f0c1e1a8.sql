-- Create a security definer function to get user's profile id
CREATE OR REPLACE FUNCTION public.get_user_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- Create function to check if user is participant of a conversation
CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants 
    WHERE conversation_id = conv_id 
    AND user_id = public.get_user_profile_id()
  )
$$;

-- Fix chat_participants RLS policies
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.chat_participants;

CREATE POLICY "Users can view participants of their conversations"
ON public.chat_participants FOR SELECT
USING (user_id = public.get_user_profile_id() OR public.is_conversation_participant(conversation_id));

-- Fix chat_conversations RLS policy  
DROP POLICY IF EXISTS "Users can view their conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Creators can update conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Creators can delete conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.chat_conversations;

CREATE POLICY "Users can view their conversations"
ON public.chat_conversations FOR SELECT
USING (public.is_conversation_participant(id) OR created_by = public.get_user_profile_id());

CREATE POLICY "Creators can update conversations"
ON public.chat_conversations FOR UPDATE
USING (created_by = public.get_user_profile_id());

CREATE POLICY "Creators can delete conversations"
ON public.chat_conversations FOR DELETE
USING (created_by = public.get_user_profile_id());

CREATE POLICY "Users can create conversations"
ON public.chat_conversations FOR INSERT
WITH CHECK (created_by = public.get_user_profile_id());

-- Fix chat_messages RLS policies
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.chat_messages;

CREATE POLICY "Users can view messages in their conversations"
ON public.chat_messages FOR SELECT
USING (public.is_conversation_participant(conversation_id));

CREATE POLICY "Users can send messages to their conversations"
ON public.chat_messages FOR INSERT
WITH CHECK (sender_id = public.get_user_profile_id() AND public.is_conversation_participant(conversation_id));

-- Fix chat_participants insert/delete
DROP POLICY IF EXISTS "Users can add participants" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can leave conversations" ON public.chat_participants;

CREATE POLICY "Users can add participants"
ON public.chat_participants FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can leave conversations"
ON public.chat_participants FOR DELETE
USING (user_id = public.get_user_profile_id());

-- Create function to check if user is in a call
CREATE OR REPLACE FUNCTION public.is_call_participant(c_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.call_participants 
    WHERE call_id = c_id 
    AND user_id = public.get_user_profile_id()
  )
$$;

-- Fix call_participants RLS policies
DROP POLICY IF EXISTS "Users can view call participants for their calls" ON public.call_participants;

CREATE POLICY "Users can view call participants for their calls"
ON public.call_participants FOR SELECT
USING (user_id = public.get_user_profile_id() OR public.is_call_participant(call_id));

-- Fix calls RLS policies
DROP POLICY IF EXISTS "Users can view calls they are part of" ON public.calls;
DROP POLICY IF EXISTS "Users can create calls" ON public.calls;
DROP POLICY IF EXISTS "Users can update calls they are part of" ON public.calls;

CREATE POLICY "Users can view calls they are part of"
ON public.calls FOR SELECT
USING (caller_id = public.get_user_profile_id() OR public.is_call_participant(id));

CREATE POLICY "Users can create calls"
ON public.calls FOR INSERT
WITH CHECK (caller_id = public.get_user_profile_id());

CREATE POLICY "Users can update calls they are part of"
ON public.calls FOR UPDATE
USING (caller_id = public.get_user_profile_id() OR public.is_call_participant(id));

-- Fix call_participants insert/update
DROP POLICY IF EXISTS "Users can insert call participants" ON public.call_participants;
DROP POLICY IF EXISTS "Users can update their own participation" ON public.call_participants;

CREATE POLICY "Users can insert call participants"
ON public.call_participants FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own participation"
ON public.call_participants FOR UPDATE
USING (user_id = public.get_user_profile_id());