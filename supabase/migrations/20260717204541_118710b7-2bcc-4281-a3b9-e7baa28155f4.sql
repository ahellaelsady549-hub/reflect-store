
REVOKE EXECUTE ON FUNCTION public.refresh_product_rating(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_product_rating_change() FROM PUBLIC, anon, authenticated;
