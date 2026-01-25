-- Таблица для кеширования постов Telegram
CREATE TABLE public.telegram_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id INTEGER UNIQUE NOT NULL,
  text TEXT,
  date TIMESTAMPTZ NOT NULL,
  image_url TEXT,
  video_url TEXT,
  link TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Индекс для сортировки по дате
CREATE INDEX idx_telegram_posts_date ON public.telegram_posts(date DESC);

-- RLS: аутентифицированные пользователи могут читать
ALTER TABLE public.telegram_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view telegram posts"
  ON public.telegram_posts FOR SELECT
  USING (auth.uid() IS NOT NULL);