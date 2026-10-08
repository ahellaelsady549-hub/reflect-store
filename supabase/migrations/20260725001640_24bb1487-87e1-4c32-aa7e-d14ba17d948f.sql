
-- Wipe seed products
DELETE FROM public.product_ratings;
ALTER TABLE public.order_items ALTER COLUMN product_id DROP NOT NULL;
UPDATE public.order_items SET product_id = NULL;
DELETE FROM public.products;

-- ============ SUPPORT MESSAGES ============
CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user','admin')),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  read_by_admin BOOLEAN NOT NULL DEFAULT false,
  read_by_user BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user read own support" ON public.support_messages FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user insert own support" ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (
    (sender_role = 'user' AND user_id = auth.uid())
    OR (sender_role = 'admin' AND public.has_role(auth.uid(), 'admin'))
  );
CREATE POLICY "update read flags" ON public.support_messages FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Notify admin on new user message
CREATE OR REPLACE FUNCTION public.notify_support_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.sender_role = 'user' THEN
    INSERT INTO public.admin_notifications (user_id, kind, message)
    VALUES (NEW.user_id, 'support_message', 'رسالة جديدة من عميل: ' || left(NEW.body, 80));
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.notify_support_message() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_notify_support_message AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_support_message();

-- ============ COMMUNITY POSTS ============
CREATE TABLE public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT ALL ON public.community_posts TO service_role;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read visible posts" ON public.community_posts FOR SELECT TO authenticated
  USING (NOT hidden OR user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "insert own posts" ON public.community_posts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "update own or admin" ON public.community_posts FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "delete own or admin" ON public.community_posts FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ============ COMMUNITY REPLIES ============
CREATE TABLE public.community_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_replies TO authenticated;
GRANT ALL ON public.community_replies TO service_role;
ALTER TABLE public.community_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read visible replies" ON public.community_replies FOR SELECT TO authenticated
  USING (NOT hidden OR user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "insert own replies" ON public.community_replies FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "update own reply or admin" ON public.community_replies FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "delete own reply or admin" ON public.community_replies FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ============ COMMUNITY REACTIONS ============
CREATE TABLE public.community_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, emoji)
);
GRANT SELECT, INSERT, DELETE ON public.community_reactions TO authenticated;
GRANT ALL ON public.community_reactions TO service_role;
ALTER TABLE public.community_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read reactions" ON public.community_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own reaction" ON public.community_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "delete own reaction" ON public.community_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============ COMMUNITY REPORTS ============
CREATE TABLE public.community_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post','reply')),
  target_id UUID NOT NULL,
  reason TEXT CHECK (reason IS NULL OR char_length(reason) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.community_reports TO authenticated;
GRANT ALL ON public.community_reports TO service_role;
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read reports" ON public.community_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "insert own report" ON public.community_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_community_report()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.admin_notifications (user_id, kind, message)
  VALUES (NEW.reporter_id, 'community_report',
    'بلاغ جديد على ' || NEW.target_type || ' - ' || COALESCE(NEW.reason,''));
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.notify_community_report() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_notify_community_report AFTER INSERT ON public.community_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_community_report();
