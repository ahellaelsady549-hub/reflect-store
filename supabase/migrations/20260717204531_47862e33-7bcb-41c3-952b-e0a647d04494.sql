
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS rating_avg numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0;

CREATE TABLE public.product_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  stars integer NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id)
);

GRANT SELECT ON public.product_ratings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_ratings TO authenticated;
GRANT ALL ON public.product_ratings TO service_role;

ALTER TABLE public.product_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ratings public read" ON public.product_ratings FOR SELECT USING (true);
CREATE POLICY "ratings own insert" ON public.product_ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ratings own update" ON public.product_ratings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ratings own delete" ON public.product_ratings FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.refresh_product_rating(_product_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.products p
  SET rating_avg = COALESCE((SELECT AVG(stars)::numeric(3,2) FROM public.product_ratings WHERE product_id = _product_id), 0),
      rating_count = COALESCE((SELECT COUNT(*) FROM public.product_ratings WHERE product_id = _product_id), 0)
  WHERE p.id = _product_id;
END; $$;

CREATE OR REPLACE FUNCTION public.on_product_rating_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_product_rating(OLD.product_id);
    RETURN OLD;
  ELSE
    PERFORM public.refresh_product_rating(NEW.product_id);
    RETURN NEW;
  END IF;
END; $$;

CREATE TRIGGER product_ratings_refresh
AFTER INSERT OR UPDATE OR DELETE ON public.product_ratings
FOR EACH ROW EXECUTE FUNCTION public.on_product_rating_change();
