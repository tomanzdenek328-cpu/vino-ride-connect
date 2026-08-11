ALTER TABLE public.tariffs
  ADD COLUMN IF NOT EXISTS hourly_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS included_km numeric NOT NULL DEFAULT 0;

INSERT INTO public.tariffs (vehicle_type,label,base_fare,per_km,capacity,weekend_base_fare,weekend_per_km,short_km_limit,short_base_fare,short_per_km,short_base_fare_weekend,short_per_km_weekend,mikulov_flat,mikulov_flat_weekend,hustopece_flat,hustopece_flat_weekend,sort_order,hourly_rate,included_km)
VALUES
 ('vip_tesla','VIP Tesla (do 4 osob)',0,40,4,0,40,5,0,40,0,40,0,0,0,0,3,0,0),
 ('vip_limuzina','VIP limuzína (do 8 osob)',0,0,8,0,0,5,0,0,0,0,0,0,0,0,4,4000,30)
ON CONFLICT (vehicle_type) DO UPDATE SET
  label=EXCLUDED.label, per_km=EXCLUDED.per_km, weekend_per_km=EXCLUDED.weekend_per_km,
  capacity=EXCLUDED.capacity, sort_order=EXCLUDED.sort_order,
  hourly_rate=EXCLUDED.hourly_rate, included_km=EXCLUDED.included_km;