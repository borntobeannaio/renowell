-- Таблица уведомлений
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('task_assigned', 'deadline_week', 'deadline_day', 'mention')),
  title text NOT NULL,
  body text NOT NULL,
  link text,
  related_task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS для уведомлений
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (recipient_id = get_user_profile_id());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (recipient_id = get_user_profile_id());

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (recipient_id = get_user_profile_id());

CREATE POLICY "Authenticated can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Таблица упоминаний в комментариях
CREATE TABLE public.comment_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.task_comments(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comment_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view mentions"
  ON public.comment_mentions FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can insert mentions"
  ON public.comment_mentions FOR INSERT
  WITH CHECK (true);

-- Включить Realtime для уведомлений
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;