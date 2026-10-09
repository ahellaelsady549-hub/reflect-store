ALTER TABLE public.orders
  ALTER COLUMN status SET DEFAULT 'paid';

GRANT INSERT ON public.orders TO authenticated;
GRANT INSERT ON public.order_items TO authenticated;

DROP POLICY IF EXISTS "own orders insert" ON public.orders;
CREATE POLICY "own orders insert" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own order items insert" ON public.order_items;
CREATE POLICY "own order items insert" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_id
        AND o.user_id = auth.uid()
    )
  );
