ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS backup_phone TEXT,
  ADD COLUMN IF NOT EXISTS google_maps_url TEXT;

NOTIFY pgrst, 'reload schema';