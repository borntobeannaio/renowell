CREATE TABLE public.tender_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  storage_path text NOT NULL,
  content_type text NOT NULL DEFAULT 'application/octet-stream',
  file_size integer NOT NULL DEFAULT 0,
  uploaded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tender_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view tender_attachments" ON public.tender_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert tender_attachments" ON public.tender_attachments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can delete tender_attachments" ON public.tender_attachments FOR DELETE TO authenticated USING (true);