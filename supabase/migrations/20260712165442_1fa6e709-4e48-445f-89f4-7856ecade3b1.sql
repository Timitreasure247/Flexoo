
-- Unify Admin and Super Admin permissions: any check for super_admin now also passes for admin.
CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role::text IN ('admin','super_admin')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_current_user_super_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_current_user_super_admin() TO authenticated, service_role;
