ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS priority boolean NOT NULL DEFAULT false;

-- Restrict drivers from updating orders that are not yet released
DROP POLICY IF EXISTS "drivers update assigned" ON public.orders;
CREATE POLICY "drivers update assigned" ON public.orders
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'driver'::app_role)
  AND ((assigned_driver_id = auth.uid()) OR (auth.uid() = ANY (assigned_driver_ids)))
  AND released = true
)
WITH CHECK (
  has_role(auth.uid(), 'driver'::app_role)
  AND ((assigned_driver_id = auth.uid()) OR (auth.uid() = ANY (assigned_driver_ids)))
);