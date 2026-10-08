DROP FUNCTION IF EXISTS public.redeem_promo_code(text);

CREATE OR REPLACE FUNCTION public.consume_promo_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.promo_code IS NOT NULL AND length(trim(NEW.promo_code)) > 0 THEN
    UPDATE public.promo_codes
    SET used_count = used_count + 1
    WHERE lower(code) = lower(NEW.promo_code)
      AND active
      AND (max_uses IS NULL OR used_count < max_uses);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER orders_consume_promo
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.consume_promo_code();