ALTER TABLE public.orders
  ALTER COLUMN status SET DEFAULT 'pending';

REVOKE INSERT ON public.orders FROM authenticated;
REVOKE INSERT ON public.order_items FROM authenticated;
REVOKE UPDATE ON public.orders FROM authenticated;
GRANT UPDATE (status) ON public.orders TO authenticated;

DROP POLICY IF EXISTS "own orders insert" ON public.orders;
DROP POLICY IF EXISTS "own order items insert" ON public.order_items;

CREATE OR REPLACE FUNCTION public.create_order(
  _items jsonb,
  _payment_method text,
  _shipping_address text,
  _phone text,
  _promo_code text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item record;
  v_product public.products%ROWTYPE;
  v_promo public.promo_codes%ROWTYPE;
  v_order_id uuid;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_total numeric;
  v_unit_price numeric;
  v_line_count integer := 0;
  v_code text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _payment_method IS NULL OR _payment_method NOT IN ('card', 'instapay', 'vodafone', 'cod') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  IF _shipping_address IS NULL OR length(btrim(_shipping_address)) NOT BETWEEN 1 AND 500
    OR _phone IS NULL OR length(btrim(_phone)) NOT BETWEEN 1 AND 32 THEN
    RAISE EXCEPTION 'Invalid shipping information';
  END IF;

  IF _items IS NULL OR pg_catalog.jsonb_typeof(_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid order items';
  END IF;

  IF pg_catalog.jsonb_array_length(_items) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Invalid order items';
  END IF;

  FOR v_item IN
    SELECT *
    FROM pg_catalog.jsonb_to_recordset(_items)
      AS item(product_id uuid, quantity integer, size text)
  LOOP
    IF v_item.product_id IS NULL OR v_item.quantity IS NULL OR v_item.quantity NOT BETWEEN 1 AND 100
      OR (v_item.size IS NOT NULL AND length(v_item.size) > 32) THEN
      RAISE EXCEPTION 'Invalid order item';
    END IF;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product is no longer available';
    END IF;

    IF v_product.price <= 0 OR v_product.discount_percent NOT BETWEEN 0 AND 100 THEN
      RAISE EXCEPTION 'Invalid product price';
    END IF;

    v_unit_price := pg_catalog.round(
      v_product.price * (100 - v_product.discount_percent)::numeric / 100
    );
    v_subtotal := v_subtotal + v_unit_price * v_item.quantity;
    v_line_count := v_line_count + 1;
  END LOOP;

  IF v_line_count = 0 THEN
    RAISE EXCEPTION 'Order must contain items';
  END IF;

  IF _promo_code IS NOT NULL AND length(btrim(_promo_code)) > 0 THEN
    v_code := btrim(_promo_code);
    SELECT * INTO v_promo
    FROM public.promo_codes
    WHERE pg_catalog.lower(code) = pg_catalog.lower(v_code)
    FOR UPDATE;

    IF NOT FOUND
      OR NOT v_promo.active
      OR v_promo.starts_at > pg_catalog.now()
      OR (v_promo.ends_at IS NOT NULL AND v_promo.ends_at < pg_catalog.now())
      OR (v_promo.max_uses IS NOT NULL AND v_promo.used_count >= v_promo.max_uses)
      OR v_subtotal < v_promo.min_order
      OR v_promo.discount_value < 0
      OR (v_promo.discount_type = 'percent' AND v_promo.discount_value > 100) THEN
      RAISE EXCEPTION 'Invalid or expired promo code';
    END IF;

    IF v_promo.discount_type = 'percent' THEN
      v_discount := pg_catalog.round(v_subtotal * v_promo.discount_value / 100);
    ELSE
      v_discount := v_promo.discount_value;
    END IF;
    v_discount := least(v_discount, v_subtotal);
  ELSE
    v_code := NULL;
  END IF;

  v_total := v_subtotal - v_discount;

  INSERT INTO public.orders (
    user_id, total, subtotal, discount_amount, promo_code, payment_method,
    shipping_address, phone, status
  )
  VALUES (
    v_user_id, v_total, v_subtotal, v_discount, v_code, _payment_method,
    btrim(_shipping_address), btrim(_phone), 'pending'
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN
    SELECT *
    FROM pg_catalog.jsonb_to_recordset(_items)
      AS item(product_id uuid, quantity integer, size text)
  LOOP
    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    FOR SHARE;

    v_unit_price := pg_catalog.round(
      v_product.price * (100 - v_product.discount_percent)::numeric / 100
    );

    INSERT INTO public.order_items (
      order_id, product_id, product_name, unit_price, quantity, size
    )
    VALUES (
      v_order_id, v_product.id, v_product.name, v_unit_price, v_item.quantity, v_item.size
    );
  END LOOP;

  IF v_code IS NOT NULL THEN
    UPDATE public.promo_codes
    SET used_count = used_count + 1
    WHERE id = v_promo.id;
  END IF;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order(jsonb, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb, text, text, text, text) TO authenticated;
