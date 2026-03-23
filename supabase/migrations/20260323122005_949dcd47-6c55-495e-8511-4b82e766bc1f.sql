
-- Companies table (for DaData-enriched company data)
CREATE TABLE public.tender_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inn text UNIQUE,
  name text NOT NULL,
  full_name text,
  ogrn text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tenders Kanban table
CREATE TABLE public.tenders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.tender_companies(id) ON DELETE SET NULL,
  project_name text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  source text,
  manager text,
  contact_info text,
  area_address text,
  interaction_history text,
  tender_start_date date,
  duration_months integer,
  budget text,
  notes text,
  lead_grade text,
  color_label text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tender_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;

-- RLS policies for tender_companies
CREATE POLICY "Authenticated users can view tender_companies" ON public.tender_companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert tender_companies" ON public.tender_companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update tender_companies" ON public.tender_companies FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete tender_companies" ON public.tender_companies FOR DELETE TO authenticated USING (true);

-- RLS policies for tenders
CREATE POLICY "Authenticated users can view tenders" ON public.tenders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert tenders" ON public.tenders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update tenders" ON public.tenders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete tenders" ON public.tenders FOR DELETE TO authenticated USING (true);

-- Updated_at trigger
CREATE TRIGGER update_tender_companies_updated_at BEFORE UPDATE ON public.tender_companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tenders_updated_at BEFORE UPDATE ON public.tenders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
