ALTER TABLE public.tariffs
  ADD COLUMN IF NOT EXISTS hourly_next_hour numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hourly_extra_km numeric NOT NULL DEFAULT 0;

UPDATE public.tariffs SET hourly_next_hour = 2500, hourly_extra_km = 25 WHERE vehicle_type = 'vip_limuzina';