-- Таблица для хранения снепшотов черновиков
CREATE TABLE public.form_draft_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES public.form_drafts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  form_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  draft_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Индексы для быстрого поиска
CREATE INDEX idx_snapshots_draft_id ON public.form_draft_snapshots(draft_id);
CREATE INDEX idx_snapshots_user_entity ON public.form_draft_snapshots(user_id, form_type, entity_id);
CREATE INDEX idx_snapshots_created_at ON public.form_draft_snapshots(created_at DESC);

-- Триггер автоматического создания снепшотов при обновлении черновика
CREATE OR REPLACE FUNCTION public.save_draft_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  -- Создать снепшот только если данные изменились
  IF OLD.draft_data IS DISTINCT FROM NEW.draft_data THEN
    INSERT INTO public.form_draft_snapshots 
      (draft_id, user_id, form_type, entity_id, draft_data)
    VALUES 
      (NEW.id, NEW.user_id, NEW.form_type, NEW.entity_id, OLD.draft_data);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER form_draft_snapshot_trigger
BEFORE UPDATE ON public.form_drafts
FOR EACH ROW
EXECUTE FUNCTION public.save_draft_snapshot();

-- Функция очистки старых снепшотов
CREATE OR REPLACE FUNCTION public.cleanup_old_snapshots()
RETURNS TRIGGER AS $$
BEGIN
  -- Удалить снепшоты старше 7 дней для этого черновика
  DELETE FROM public.form_draft_snapshots
  WHERE draft_id = NEW.draft_id
    AND created_at < NOW() - INTERVAL '7 days';
  
  -- Оставить только последние 50 снепшотов на черновик
  DELETE FROM public.form_draft_snapshots
  WHERE id IN (
    SELECT id FROM public.form_draft_snapshots
    WHERE draft_id = NEW.draft_id
    ORDER BY created_at DESC
    OFFSET 50
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER cleanup_snapshots_trigger
AFTER INSERT ON public.form_draft_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_old_snapshots();

-- RLS политики
ALTER TABLE public.form_draft_snapshots ENABLE ROW LEVEL SECURITY;

-- Пользователи могут видеть только свои снепшоты
CREATE POLICY "Users can view own snapshots"
  ON public.form_draft_snapshots FOR SELECT
  USING (user_id = auth.uid());

-- Вставка через триггер (SECURITY DEFINER)
CREATE POLICY "System can insert snapshots"
  ON public.form_draft_snapshots FOR INSERT
  WITH CHECK (true);

-- Пользователи могут удалять свои снепшоты
CREATE POLICY "Users can delete own snapshots"
  ON public.form_draft_snapshots FOR DELETE
  USING (user_id = auth.uid());