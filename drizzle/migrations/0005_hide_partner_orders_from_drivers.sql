CREATE POLICY "partner orders dispatcher only" ON public.orders AS RESTRICTIVE FOR SELECT TO authenticated
USING (partner_direction IS DISTINCT FROM 'out' OR (public.has_role(auth.uid(), 'dispatcher') AND NOT public.is_helper_dispatcher(auth.uid())));
CREATE POLICY "partner orders no driver update" ON public.orders AS RESTRICTIVE FOR UPDATE TO authenticated
USING (partner_direction IS DISTINCT FROM 'out' OR (public.has_role(auth.uid(), 'dispatcher') AND NOT public.is_helper_dispatcher(auth.uid())));