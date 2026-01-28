-- Create table for protocol item comment mentions
CREATE TABLE public.protocol_item_comment_mentions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id uuid NOT NULL REFERENCES public.protocol_item_comments(id) ON DELETE CASCADE,
    mentioned_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (comment_id, mentioned_user_id)
);

-- Enable RLS
ALTER TABLE public.protocol_item_comment_mentions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated can view protocol item comment mentions" 
    ON public.protocol_item_comment_mentions FOR SELECT 
    USING (true);

CREATE POLICY "Authenticated can insert protocol item comment mentions" 
    ON public.protocol_item_comment_mentions FOR INSERT 
    WITH CHECK (true);

-- Enable realtime (optional, for future use)
ALTER PUBLICATION supabase_realtime ADD TABLE public.protocol_item_comment_mentions;