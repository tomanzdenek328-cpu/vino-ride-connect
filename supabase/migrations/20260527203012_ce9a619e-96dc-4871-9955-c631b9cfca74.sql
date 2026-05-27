
DROP POLICY IF EXISTS "drivers read pending or assigned" ON public.orders;
CREATE POLICY "drivers read pending or assigned"
ON public.orders
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'driver'::app_role) AND (
    status = 'pending'::order_status
    OR assigned_driver_id = auth.uid()
    OR auth.uid() = ANY (assigned_driver_ids)
  )
);
