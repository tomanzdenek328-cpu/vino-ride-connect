CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads settings" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "dispatchers manage settings" ON public.app_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'dispatcher'::app_role)) WITH CHECK (has_role(auth.uid(), 'dispatcher'::app_role));
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
CREATE TRIGGER app_settings_set_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
INSERT INTO public.app_settings (key, value) VALUES ('customer_orders', '{"enabled": true}'::jsonb);