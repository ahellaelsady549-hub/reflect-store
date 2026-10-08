
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile upsert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  image_url TEXT,
  price NUMERIC(10,2) NOT NULL,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products public read" ON public.products FOR SELECT TO anon, authenticated USING (true);

-- Orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  payment_method TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own orders read" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own orders insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Order items
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL
);
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own order items read" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "own order items insert" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));

-- Seed clothing products
INSERT INTO public.products (name, description, category, image_url, price, discount_percent) VALUES
('تيشيرت قطن كلاسيك', 'تيشيرت رجالي قطن 100% مريح للاستخدام اليومي', 'رجالي', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800', 350.00, 15),
('قميص كاجوال مقلم', 'قميص كاجوال بقصة عصرية وألوان أنيقة', 'رجالي', 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800', 650.00, 20),
('بنطلون جينز سليم فيت', 'جينز رجالي بقصة سليم فيت ولون أزرق كلاسيك', 'رجالي', 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800', 899.00, 10),
('جاكيت شتوي دافي', 'جاكيت رجالي شتوي بحشو دافي ومقاوم للماء', 'رجالي', 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800', 1499.00, 25),
('فستان سهرة أنيق', 'فستان سهرة نسائي بتصميم راقي مناسب للمناسبات', 'حريمي', 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800', 1750.00, 30),
('بلوزة صيفي ناعمة', 'بلوزة نسائية خفيفة مناسبة للصيف', 'حريمي', 'https://images.unsplash.com/photo-1564257577-2d3ee8740ae4?w=800', 420.00, 15),
('جيبة ميدي كاجوال', 'جيبة نسائية بطول ميدي وقصة عصرية', 'حريمي', 'https://images.unsplash.com/photo-1583496661160-fb5886a13d44?w=800', 550.00, 0),
('حذاء رياضي أبيض', 'حذاء رياضي مريح للاستخدام اليومي بألوان بيضاء', 'أحذية', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800', 1200.00, 20),
('حذاء كلاسيك جلد', 'حذاء رجالي جلد طبيعي بتصميم كلاسيكي', 'أحذية', 'https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=800', 1650.00, 15),
('شنطة يد نسائية', 'شنطة يد أنيقة من الجلد الصناعي عالي الجودة', 'إكسسوارات', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800', 780.00, 25),
('ساعة يد كلاسيك', 'ساعة يد رجالي أنيقة بتصميم كلاسيكي', 'إكسسوارات', 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=800', 2200.00, 30),
('كاب رياضي', 'كاب رياضي عصري مناسب للجميع', 'إكسسوارات', 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800', 250.00, 10);
