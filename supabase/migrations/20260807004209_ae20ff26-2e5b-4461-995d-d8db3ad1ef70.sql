ALTER TABLE public.tariffs
  ADD COLUMN IF NOT EXISTS short_base_fare numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS short_per_km numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS short_base_fare_weekend numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS short_per_km_weekend numeric NOT NULL DEFAULT 0;

ALTER TABLE public.tariffs
  DROP COLUMN IF EXISTS short_price,
  DROP COLUMN IF EXISTS short_price_weekend;