-- Create protocol_sections table
CREATE TABLE public.protocol_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id UUID NOT NULL REFERENCES public.protocols(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL DEFAULT 'project',
  entity_id UUID NULL REFERENCES public.projects(id) ON DELETE SET NULL,
  entity_name TEXT NULL,
  default_responsible TEXT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.protocol_sections ENABLE ROW LEVEL SECURITY;

-- RLS policies for protocol_sections
CREATE POLICY "Authenticated users can view protocol_sections"
  ON public.protocol_sections FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert protocol_sections"
  ON public.protocol_sections FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update protocol_sections"
  ON public.protocol_sections FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete protocol_sections"
  ON public.protocol_sections FOR DELETE USING (true);

-- Add section_id to protocol_items
ALTER TABLE public.protocol_items 
  ADD COLUMN section_id UUID NULL REFERENCES public.protocol_sections(id) ON DELETE CASCADE;

-- Add goal-specific columns to protocol_items
ALTER TABLE public.protocol_items 
  ADD COLUMN kpi TEXT NULL,
  ADD COLUMN status TEXT NULL,
  ADD COLUMN status_date DATE NULL;

-- Create trigger for updated_at on protocol_sections
CREATE TRIGGER update_protocol_sections_updated_at
  BEFORE UPDATE ON public.protocol_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing data: create sections from protocol_items
INSERT INTO public.protocol_sections (protocol_id, section_type, entity_id, sort_order)
SELECT DISTINCT 
  pi.protocol_id, 
  'project' as section_type,
  pi.project_id as entity_id,
  (ROW_NUMBER() OVER (PARTITION BY pi.protocol_id ORDER BY MIN(pi.sort_order))) - 1
FROM public.protocol_items pi
GROUP BY pi.protocol_id, pi.project_id;

-- Link existing items to their sections
UPDATE public.protocol_items pi
SET section_id = ps.id
FROM public.protocol_sections ps
WHERE ps.protocol_id = pi.protocol_id 
  AND (
    (ps.entity_id IS NOT NULL AND ps.entity_id = pi.project_id) 
    OR (ps.entity_id IS NULL AND pi.project_id IS NULL)
  );