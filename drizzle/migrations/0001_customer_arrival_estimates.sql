ALTER TABLE public.orders
 ADD COLUMN manual_arrival_at timestamptz,
 ADD COLUMN pickup_departed_at timestamptz,
 ADD COLUMN arrival_eta_minutes integer CHECK (arrival_eta_minutes IS NULL OR arrival_eta_minutes >= 0),
 ADD COLUMN arrival_eta_updated_at timestamptz,
 ADD COLUMN arrival_eta_driver_id uuid,
 ADD COLUMN arrival_eta_approx boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.orders.pickup_departed_at IS 'Journey to customer pickup started; distinct from in_progress passenger ride.';