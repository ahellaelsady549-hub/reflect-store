DROP POLICY IF EXISTS "authenticated insert audit" ON public.admin_audit_log;
DROP POLICY IF EXISTS "auth insert own notif" ON public.admin_notifications;
REVOKE INSERT ON public.admin_audit_log FROM authenticated;
REVOKE INSERT ON public.admin_notifications FROM authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
GRANT ALL ON public.admin_notifications TO service_role;