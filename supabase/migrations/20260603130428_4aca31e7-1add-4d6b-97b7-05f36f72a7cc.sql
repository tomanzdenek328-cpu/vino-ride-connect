CREATE TABLE public.cash_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_payouts TO authenticated;
GRANT ALL ON public.cash_payouts TO service_role;

ALTER TABLE public.cash_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dispatchers manage payouts"
ON public.cash_payouts FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'dispatcher'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'dispatcher'::public.app_role));

CREATE POLICY "drivers read own payouts"
ON public.cash_payouts FOR SELECT
TO authenticated
USING (auth.uid() = driver_id);

CREATE INDEX idx_cash_payouts_driver ON public.cash_payouts(driver_id);