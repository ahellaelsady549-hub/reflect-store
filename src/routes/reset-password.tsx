import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LockKeyhole } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "إعادة تعيين كلمة المرور | Reflect" },
      { name: "description", content: "اختر كلمة مرور جديدة لحسابك في Reflect وأكمل تسوقك بأمان." },
      { property: "og:title", content: "إعادة تعيين كلمة المرور | Reflect" },
      { property: "og:description", content: "اختر كلمة مرور جديدة لحسابك وأكمل تسوقك بأمان." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const isRecovery = hash.includes("type=recovery");
    supabase.auth.getSession().then(({ data }) => {
      setReady(isRecovery || !!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) { toast.error(t("passwords_mismatch")); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("password_updated"));
    navigate({ to: "/" });
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="mb-4 flex items-center gap-2 text-xl font-bold">
          <LockKeyhole className="h-5 w-5 shrink-0" /> {t("reset_password")}
        </h1>
        {!ready ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)}
              placeholder={t("new_password")} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
            <input type="password" required minLength={6} value={pw2} onChange={(e) => setPw2(e.target.value)}
              placeholder={t("confirm_password")} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("loading") : t("reset_password")}
            </Button>
          </form>
        )}
        <Link to="/auth" className="mt-4 block text-center text-sm text-primary hover:underline">
          {t("back_to_login")}
        </Link>
      </div>
    </div>
  );
}
