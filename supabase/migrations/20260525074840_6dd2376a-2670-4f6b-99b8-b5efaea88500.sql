-- 1. Таблица для постов ленты новостей (включая авто-поздравления)
CREATE TABLE public.news_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'news', -- 'news' | 'congrats'
  title text NOT NULL,
  body text NOT NULL,
  author text NOT NULL DEFAULT 'Renowell',
  tags text[] NOT NULL DEFAULT '{}',
  related_employee_id uuid,
  mentioned_employees uuid[] NOT NULL DEFAULT '{}',
  date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Europe/Moscow')::date),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view news_posts"
  ON public.news_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert news_posts"
  ON public.news_posts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update news_posts"
  ON public.news_posts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete news_posts"
  ON public.news_posts FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_news_posts_updated_at
  BEFORE UPDATE ON public.news_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_news_posts_date ON public.news_posts (date DESC, created_at DESC);

-- 2. Лог поздравлений: один сотрудник = одно поздравление в год
CREATE TABLE public.birthday_greetings_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  year integer NOT NULL,
  news_post_id uuid REFERENCES public.news_posts(id) ON DELETE SET NULL,
  telegram_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, year)
);

ALTER TABLE public.birthday_greetings_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view birthday_greetings_log"
  ON public.birthday_greetings_log FOR SELECT TO authenticated USING (true);

-- 3. Ежедневный cron: 06:00 UTC = 09:00 МСК
SELECT cron.schedule(
  'birthday-greetings-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://kstfczzkskpmsswmanif.supabase.co/functions/v1/birthday-greetings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);