
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate text NOT NULL,
  car_type text NOT NULL DEFAULT '',
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_plate_unique ON public.vehicles (lower(plate));

GRANT SELECT ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read vehicles" ON public.vehicles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "dispatchers manage vehicles" ON public.vehicles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'dispatcher'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'dispatcher'::public.app_role));

CREATE TRIGGER vehicles_set_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.driver_locations
  ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL;
