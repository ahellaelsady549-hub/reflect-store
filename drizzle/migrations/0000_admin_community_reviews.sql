ALTER TABLE public.product_ratings ADD COLUMN IF NOT EXISTS comment text;

CREATE OR REPLACE FUNCTION public.validate_product_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.stars < 1 OR NEW.stars > 5 THEN RAISE EXCEPTION 'Stars must be 1-5'; END IF;
  IF NEW.comment IS NOT NULL AND length(NEW.comment) > 1000 THEN RAISE EXCEPTION 'Review too long'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.orders o JOIN public.order_items i ON i.order_id = o.id
    WHERE o.user_id = NEW.user_id AND o.status = 'delivered' AND i.product_id = NEW.product_id
  ) THEN
    RAISE EXCEPTION 'You can review only after your order is delivered';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS product_ratings_validate ON public.product_ratings;
CREATE TRIGGER product_ratings_validate BEFORE INSERT OR UPDATE ON public.product_ratings
FOR EACH ROW EXECUTE FUNCTION public.validate_product_rating();

DROP POLICY IF EXISTS "insert own posts" ON public.community_posts;
CREATE POLICY "admin insert posts" ON public.community_posts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.on_new_auth_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  IF lower(NEW.email) = 'reflect@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  INSERT INTO public.admin_notifications (user_id, kind, message)
  VALUES (NEW.id, 'signup', 'مستخدم جديد سجل: ' || COALESCE(NEW.email, ''));
  RETURN NEW;
END; $function$;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE lower(email) = 'reflect@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;