ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS approval text NOT NULL DEFAULT 'approved';
ALTER TABLE public.orders ADD CONSTRAINT orders_approval_check CHECK (approval IN ('pending','approved','rejected'));
UPDATE public.orders SET approval = 'approved' WHERE approval IS NULL;