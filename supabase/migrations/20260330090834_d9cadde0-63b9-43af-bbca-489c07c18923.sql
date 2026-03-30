
CREATE TABLE public.tender_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tender_id UUID NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tender_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tender comments" ON public.tender_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert tender comments" ON public.tender_comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authors can update own tender comments" ON public.tender_comments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authors can delete own tender comments" ON public.tender_comments FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_tender_comments_updated_at BEFORE UPDATE ON public.tender_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
