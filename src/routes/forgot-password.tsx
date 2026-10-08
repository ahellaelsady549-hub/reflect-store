import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { OtpVerify } from "@/components/otp-verify";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "نسيت كلمة المرور | Reflect" },
      { name: "description", content: "استعد الوصول لحسابك في Reflect عبر رابط إعادة تعيين كلمة المرور." },
      { property: "og:title", content: "نسيت كلمة المرور | Reflect" },
      { property: "og:description", content: "استعد الوصول لحسابك عبر رابط إعادة تعيين كلمة المرور." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
    toast.success(t("otp_code_sent"));
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="mb-4 flex items-center gap-2 text-xl font-bold">
          <KeyRound className="h-5 w-5 shrink-0" /> {t("reset_password")}
        </h1>
        {sent ? (
          <OtpVerify
            email={email.trim()}
            type="recovery"
            onVerified={() => navigate({ to: "/reset-password" })}
          />
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={t("email")}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("loading") : t("send_reset_link")}
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
