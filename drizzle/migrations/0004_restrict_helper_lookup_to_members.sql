REVOKE EXECUTE ON FUNCTION public.is_helper_dispatcher(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_helper_dispatcher(uuid) TO authenticated, service_role;