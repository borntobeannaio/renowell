-- Create protocols table
CREATE TABLE public.protocols (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  number INTEGER NOT NULL,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  organizer TEXT,
  meeting_type TEXT,
  attendees TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for protocols
ALTER TABLE public.protocols ENABLE ROW LEVEL SECURITY;

-- RLS policies for protocols
CREATE POLICY "Authenticated users can view protocols"
  ON public.protocols FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert protocols"
  ON public.protocols FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update protocols"
  ON public.protocols FOR UPDATE
  USING (true);

CREATE POLICY "Authenticated users can delete protocols"
  ON public.protocols FOR DELETE
  USING (true);

-- Create protocol_items table (items grouped by project)
CREATE TABLE public.protocol_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol_id UUID NOT NULL REFERENCES public.protocols(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  item_text TEXT NOT NULL,
  responsible TEXT,
  due_date DATE,
  create_task BOOLEAN DEFAULT false,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for protocol_items
ALTER TABLE public.protocol_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for protocol_items
CREATE POLICY "Authenticated users can view protocol_items"
  ON public.protocol_items FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert protocol_items"
  ON public.protocol_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update protocol_items"
  ON public.protocol_items FOR UPDATE
  USING (true);

CREATE POLICY "Authenticated users can delete protocol_items"
  ON public.protocol_items FOR DELETE
  USING (true);

-- Add update triggers
CREATE TRIGGER update_protocols_updated_at
  BEFORE UPDATE ON public.protocols
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_protocol_items_updated_at
  BEFORE UPDATE ON public.protocol_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();