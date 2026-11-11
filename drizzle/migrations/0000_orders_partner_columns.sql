ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS partner_direction text,
  ADD COLUMN IF NOT EXISTS partner_state text,
  ADD COLUMN IF NOT EXISTS partner_remote_status text,
  ADD COLUMN IF NOT EXISTS partner_remote_id uuid,
  ADD COLUMN IF NOT EXISTS partner_name text;
CREATE INDEX IF NOT EXISTS orders_partner_remote_idx ON public.orders (partner_remote_id) WHERE partner_remote_id IS NOT NULL;