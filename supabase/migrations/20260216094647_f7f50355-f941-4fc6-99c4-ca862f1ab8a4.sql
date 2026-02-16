
-- Create bot_settings key-value table
CREATE TABLE public.bot_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;

-- No public policies needed - edge functions use service_role key which bypasses RLS
