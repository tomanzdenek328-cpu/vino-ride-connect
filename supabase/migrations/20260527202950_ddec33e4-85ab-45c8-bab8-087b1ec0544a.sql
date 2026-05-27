
ALTER TABLE public.orders ADD COLUMN released boolean NOT NULL DEFAULT true;

-- Drop and recreate driver read policy: only released pending orders are visible as pickable;
-- assigned orders always visible to the driver(s) they were assigned to.
DROP POLICY IF EXISTS "drivers read pending or assigned" ON public.orders;
CREATE POLICY "drivers read pending or assigned"
ON public.orders
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'driver'::app_role) AND (
    (status = 'pending'::order_status AND released = true)
    OR assigned_driver_id = auth.uid()
    OR auth.uid() = ANY (assigned_driver_ids)
  )
);

-- Drop and recreate claim policy: drivers can only claim released pending orders.
DROP POLICY IF EXISTS "drivers claim pending" ON public.orders;
CREATE POLICY "drivers claim pending"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'driver'::app_role)
  AND status = 'pending'::order_status
  AND assigned_driver_id IS NULL
  AND released = true
)
WITH CHECK (
  has_role(auth.uid(), 'driver'::app_role)
  AND assigned_driver_id = auth.uid()
);
