
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vehicle_type text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_driver_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

DROP POLICY IF EXISTS "drivers read pending or assigned" ON public.orders;
CREATE POLICY "drivers read pending or assigned"
ON public.orders
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'driver'::app_role)
  AND (
    status = 'pending'::order_status
    OR assigned_driver_id = auth.uid()
    OR auth.uid() = ANY(assigned_driver_ids)
  )
);

DROP POLICY IF EXISTS "drivers update assigned" ON public.orders;
CREATE POLICY "drivers update assigned"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'driver'::app_role)
  AND (assigned_driver_id = auth.uid() OR auth.uid() = ANY(assigned_driver_ids))
)
WITH CHECK (
  has_role(auth.uid(), 'driver'::app_role)
  AND (assigned_driver_id = auth.uid() OR auth.uid() = ANY(assigned_driver_ids))
);
