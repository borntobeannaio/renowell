-- Create table for task comments
CREATE TABLE public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view task comments"
ON public.task_comments
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert task comments"
ON public.task_comments
FOR INSERT
TO authenticated
WITH CHECK (author_id = get_user_profile_id());

CREATE POLICY "Users can update their own comments"
ON public.task_comments
FOR UPDATE
TO authenticated
USING (author_id = get_user_profile_id());

CREATE POLICY "Users can delete their own comments"
ON public.task_comments
FOR DELETE
TO authenticated
USING (author_id = get_user_profile_id());

-- Add trigger for updated_at
CREATE TRIGGER update_task_comments_updated_at
BEFORE UPDATE ON public.task_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;