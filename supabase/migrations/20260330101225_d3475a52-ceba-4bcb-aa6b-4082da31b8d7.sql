
-- Interaction history entries
CREATE TABLE public.tender_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  author_id uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.tender_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view tender_interactions" ON public.tender_interactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert tender_interactions" ON public.tender_interactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update tender_interactions" ON public.tender_interactions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete tender_interactions" ON public.tender_interactions FOR DELETE TO authenticated USING (true);

-- Structured contacts
CREATE TABLE public.tender_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  name text DEFAULT '',
  phone text DEFAULT '',
  description text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tender_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view tender_contacts" ON public.tender_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert tender_contacts" ON public.tender_contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update tender_contacts" ON public.tender_contacts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete tender_contacts" ON public.tender_contacts FOR DELETE TO authenticated USING (true);
