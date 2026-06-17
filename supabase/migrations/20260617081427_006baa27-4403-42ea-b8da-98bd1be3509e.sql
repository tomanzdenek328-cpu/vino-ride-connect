DROP POLICY IF EXISTS "users read own role" ON public.user_roles;
CREATE POLICY "authenticated read all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (true);