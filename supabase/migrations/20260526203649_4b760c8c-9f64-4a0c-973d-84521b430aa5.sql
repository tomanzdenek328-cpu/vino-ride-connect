
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS scheduled_time timestamptz,
  ADD COLUMN IF NOT EXISTS passengers integer NOT NULL DEFAULT 1;
