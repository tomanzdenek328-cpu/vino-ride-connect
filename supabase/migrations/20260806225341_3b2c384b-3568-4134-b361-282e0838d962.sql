ALTER TABLE public.orders ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_code text UNIQUE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'dispatch';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_price numeric;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_distance_km numeric;

ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS photo_url text;

CREATE TABLE IF NOT EXISTS public.tariffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type text NOT NULL UNIQUE,
  label text NOT NULL,
  base_fare numeric NOT NULL DEFAULT 0,
  per_km numeric NOT NULL DEFAULT 0,
  capacity integer NOT NULL DEFAULT 4,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tariffs TO anon;
GRANT SELECT ON public.tariffs TO authenticated;
GRANT ALL ON public.tariffs TO service_role;

ALTER TABLE public.tariffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads tariffs" ON public.tariffs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "dispatchers manage tariffs" ON public.tariffs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'dispatcher'::app_role))
  WITH CHECK (has_role(auth.uid(), 'dispatcher'::app_role));

CREATE TRIGGER tariffs_set_updated_at BEFORE UPDATE ON public.tariffs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.tariffs (vehicle_type, label, base_fare, per_km, capacity, sort_order) VALUES
  ('osobni', 'Osobní auto (do 4 osob)', 50, 30, 4, 1),
  ('dodavka', 'Dodávka (do 8 osob)', 100, 45, 8, 2)
ON CONFLICT (vehicle_type) DO NOTHING;