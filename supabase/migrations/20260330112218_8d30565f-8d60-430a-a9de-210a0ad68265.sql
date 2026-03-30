CREATE TABLE public.tender_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  text text NOT NULL DEFAULT '',
  completed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tender_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view tender_checklist_items" ON public.tender_checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert tender_checklist_items" ON public.tender_checklist_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update tender_checklist_items" ON public.tender_checklist_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete tender_checklist_items" ON public.tender_checklist_items FOR DELETE TO authenticated USING (true);