-- Таблица для хранения черновиков форм
CREATE TABLE public.form_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  form_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  draft_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, form_type, entity_id)
);

-- Индексы
CREATE INDEX idx_form_drafts_user ON public.form_drafts(user_id);
CREATE INDEX idx_form_drafts_updated ON public.form_drafts(updated_at DESC);

-- Триггер для updated_at
CREATE TRIGGER update_form_drafts_updated_at
  BEFORE UPDATE ON public.form_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.form_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own drafts" 
  ON public.form_drafts FOR SELECT 
  TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own drafts" 
  ON public.form_drafts FOR INSERT 
  TO authenticated 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own drafts" 
  ON public.form_drafts FOR UPDATE 
  TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own drafts" 
  ON public.form_drafts FOR DELETE 
  TO authenticated 
  USING (user_id = auth.uid());