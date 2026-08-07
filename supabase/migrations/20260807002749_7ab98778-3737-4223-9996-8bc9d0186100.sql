
ALTER TABLE public.tariffs
  ADD COLUMN IF NOT EXISTS weekend_base_fare numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekend_per_km numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS short_km_limit numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS short_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS short_price_weekend numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mikulov_flat numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mikulov_flat_weekend numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hustopece_flat numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hustopece_flat_weekend numeric NOT NULL DEFAULT 0;

UPDATE public.tariffs SET
  weekend_base_fare = CASE WHEN weekend_base_fare = 0 THEN base_fare ELSE weekend_base_fare END,
  weekend_per_km = CASE WHEN weekend_per_km = 0 THEN per_km ELSE weekend_per_km END;

UPDATE public.tariffs SET
  short_price = 150, short_price_weekend = 200,
  mikulov_flat = 150, mikulov_flat_weekend = 200,
  hustopece_flat = 100, hustopece_flat_weekend = 150
WHERE vehicle_type = 'osobni' AND short_price = 0;

UPDATE public.tariffs SET
  short_price = 250, short_price_weekend = 300,
  mikulov_flat = 250, mikulov_flat_weekend = 300,
  hustopece_flat = 200, hustopece_flat_weekend = 250
WHERE vehicle_type = 'dodavka' AND short_price = 0;
