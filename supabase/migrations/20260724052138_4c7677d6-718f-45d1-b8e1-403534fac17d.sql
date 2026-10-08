
-- 1) Restrict product_ratings SELECT to authenticated
DROP POLICY IF EXISTS "ratings public read" ON public.product_ratings;
CREATE POLICY "ratings authenticated read" ON public.product_ratings
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.product_ratings FROM anon;

-- 2) Convert has_role to SECURITY INVOKER (it only ever checks auth.uid() and user_roles has RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 3) Revoke public EXECUTE on SECURITY DEFINER trigger functions (triggers still fire)
REVOKE EXECUTE ON FUNCTION public.notify_profile_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_new_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_product_rating_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_product_rating(uuid) FROM PUBLIC, anon, authenticated;
