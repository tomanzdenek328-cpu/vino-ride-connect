
-- 1. busy flag for drivers
ALTER TABLE public.driver_locations
  ADD COLUMN IF NOT EXISTS busy boolean NOT NULL DEFAULT false;

-- 2. Fix RLS so a driver can claim a pending order (assigned_driver_id is NULL before claim)
DROP POLICY IF EXISTS "drivers claim pending" ON public.orders;
CREATE POLICY "drivers claim pending"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'driver'::app_role)
    AND status = 'pending'
    AND assigned_driver_id IS NULL
  )
  WITH CHECK (
    has_role(auth.uid(), 'driver'::app_role)
    AND assigned_driver_id = auth.uid()
  );

-- 3. rides table
CREATE TABLE IF NOT EXISTS public.rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  payment_method text NOT NULL CHECK (payment_method IN ('cash','card')),
  pickup_address text,
  destination text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rides TO authenticated;
GRANT ALL ON public.rides TO service_role;

ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver reads own rides"
  ON public.rides FOR SELECT
  TO authenticated
  USING (auth.uid() = driver_id);

CREATE POLICY "dispatcher reads all rides"
  ON public.rides FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'dispatcher'::app_role));

CREATE POLICY "driver inserts own ride"
  ON public.rides FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = driver_id);

CREATE INDEX IF NOT EXISTS idx_rides_driver ON public.rides(driver_id, completed_at DESC);
