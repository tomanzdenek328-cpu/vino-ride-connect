CREATE POLICY "dispatchers update driver locations"
ON public.driver_locations
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'dispatcher'))
WITH CHECK (public.has_role(auth.uid(), 'dispatcher'));