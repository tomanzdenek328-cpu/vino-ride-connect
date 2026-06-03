
CREATE TABLE public.sos_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  vehicle_id uuid,
  lat double precision,
  lng double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sos_alerts TO authenticated;
GRANT ALL ON public.sos_alerts TO service_role;

ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read all sos"
  ON public.sos_alerts FOR SELECT TO authenticated USING (true);

CREATE POLICY "driver insert own sos"
  ON public.sos_alerts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "driver resolve own sos"
  ON public.sos_alerts FOR UPDATE TO authenticated
  USING (auth.uid() = driver_id)
  WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "dispatcher manages sos"
  ON public.sos_alerts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'dispatcher'::app_role))
  WITH CHECK (has_role(auth.uid(), 'dispatcher'::app_role));

CREATE INDEX sos_alerts_active_idx ON public.sos_alerts (created_at DESC) WHERE resolved_at IS NULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_alerts;
ALTER TABLE public.sos_alerts REPLICA IDENTITY FULL;
