-- Wishlist
CREATE TABLE public.wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

GRANT SELECT, INSERT, DELETE ON public.wishlists TO authenticated;
GRANT ALL ON public.wishlists TO service_role;

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own wishlist read" ON public.wishlists FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own wishlist insert" ON public.wishlists FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own wishlist delete" ON public.wishlists FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Sizes inventory: [{"size":"M","stock":5}]
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sizes jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Size on order line
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS size text;

-- Inventory enforcement
CREATE OR REPLACE FUNCTION public.consume_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock int;
  v_sizes jsonb;
  v_idx int;
  v_size_stock int;
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;

  SELECT stock, sizes INTO v_stock, v_sizes FROM public.products WHERE id = NEW.product_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF NEW.size IS NOT NULL AND jsonb_array_length(COALESCE(v_sizes, '[]'::jsonb)) > 0 THEN
    SELECT ord - 1, (elem->>'stock')::int INTO v_idx, v_size_stock
    FROM jsonb_array_elements(v_sizes) WITH ORDINALITY AS a(elem, ord)
    WHERE elem->>'size' = NEW.size
    LIMIT 1;

    IF v_idx IS NULL THEN
      RAISE EXCEPTION 'Size not available';
    END IF;
    IF COALESCE(v_size_stock, 0) < NEW.quantity THEN
      RAISE EXCEPTION 'Out of stock for selected size';
    END IF;

    v_sizes := jsonb_set(v_sizes, ARRAY[v_idx::text, 'stock'], to_jsonb(v_size_stock - NEW.quantity));
    UPDATE public.products
    SET sizes = v_sizes,
        stock = GREATEST(0, COALESCE(stock, 0) - NEW.quantity)
    WHERE id = NEW.product_id;
  ELSE
    IF COALESCE(v_stock, 0) < NEW.quantity THEN
      RAISE EXCEPTION 'Out of stock';
    END IF;
    UPDATE public.products SET stock = COALESCE(stock, 0) - NEW.quantity WHERE id = NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_inventory() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS order_items_consume_inventory ON public.order_items;
CREATE TRIGGER order_items_consume_inventory
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.consume_inventory();