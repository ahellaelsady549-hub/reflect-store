
-- Audit log table
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read audit" ON public.admin_audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "authenticated insert audit" ON public.admin_audit_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id OR actor_id IS NULL);

-- Trigger: log product changes
CREATE OR REPLACE FUNCTION public.log_product_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.admin_audit_log (actor_id, actor_email, action, entity_type, entity_id, details)
    VALUES (auth.uid(), v_email, 'create', 'product', NEW.id::text,
      jsonb_build_object('name', NEW.name, 'price', NEW.price, 'category', NEW.category));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.admin_audit_log (actor_id, actor_email, action, entity_type, entity_id, details)
    VALUES (auth.uid(), v_email, 'delete', 'product', OLD.id::text,
      jsonb_build_object('name', OLD.name, 'price', OLD.price));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_product_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_log_product_ins ON public.products;
DROP TRIGGER IF EXISTS trg_log_product_del ON public.products;
CREATE TRIGGER trg_log_product_ins AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_product_change();
CREATE TRIGGER trg_log_product_del AFTER DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_product_change();

-- Trigger: log profile changes (name)
CREATE OR REPLACE FUNCTION public.log_profile_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
    SELECT email INTO v_email FROM auth.users WHERE id = NEW.id;
    INSERT INTO public.admin_audit_log (actor_id, actor_email, action, entity_type, entity_id, details)
    VALUES (NEW.id, v_email, 'update', 'user_profile', NEW.id::text,
      jsonb_build_object('field', 'full_name', 'old', OLD.full_name, 'new', NEW.full_name));
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_profile_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_log_profile_upd ON public.profiles;
CREATE TRIGGER trg_log_profile_upd AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_profile_change();

-- Allow admins to update order status (for tracking)
CREATE POLICY "admin update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
