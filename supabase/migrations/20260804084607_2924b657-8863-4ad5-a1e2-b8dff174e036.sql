CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL DEFAULT 'percent',
  discount_value numeric NOT NULL DEFAULT 0,
  min_order numeric NOT NULL DEFAULT 0,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_discount_type_chk CHECK (discount_type IN ('percent','fixed'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read active promo codes" ON public.promo_codes
FOR SELECT TO authenticated
USING (active OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin insert promo codes" ON public.promo_codes
FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin update promo codes" ON public.promo_codes
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin delete promo codes" ON public.promo_codes
FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER promo_codes_touch BEFORE UPDATE ON public.promo_codes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal numeric;

CREATE POLICY "user cancel own order before shipping" ON public.orders
FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND status IN ('pending','paid'))
WITH CHECK (auth.uid() = user_id AND status = 'cancelled');

CREATE OR REPLACE FUNCTION public.redeem_promo_code(_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.promo_codes
  SET used_count = used_count + 1
  WHERE lower(code) = lower(_code)
    AND active
    AND (max_uses IS NULL OR used_count < max_uses);
END; $$;

REVOKE ALL ON FUNCTION public.redeem_promo_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(text) TO authenticated;