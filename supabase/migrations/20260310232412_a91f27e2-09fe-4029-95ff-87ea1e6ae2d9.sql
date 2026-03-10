
CREATE TABLE public.hr_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'pdf',
  file_url TEXT,
  storage_path TEXT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.hr_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view hr_documents"
  ON public.hr_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert hr_documents"
  ON public.hr_documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update hr_documents"
  ON public.hr_documents FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete hr_documents"
  ON public.hr_documents FOR DELETE
  TO authenticated
  USING (true);
