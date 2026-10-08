import { useEffect, useState } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";

const CODE_TTL_MS = 30 * 60 * 1000; // 30 minutes

type Props = {
  email: string;
  type: "signup" | "recovery";
  onVerified: () => void;
};

export function OtpVerify({ email, type, onVerified }: Props) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentAt, setSentAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const msLeft = Math.max(0, sentAt + CODE_TTL_MS - now);
  const expired = msLeft === 0;
  const mm = String(Math.floor(msLeft / 60000)).padStart(2, "0");
  const ss = String(Math.floor((msLeft % 60000) / 1000)).padStart(2, "0");

  async function verify(value: string) {
    if (value.length !== 6 || loading) return;
    if (expired) {
      toast.error(t("otp_expired"));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: value,
        type: type === "signup" ? "signup" : "recovery",
      });
      if (error) throw error;
      toast.success(t("otp_verified"));
      onVerified();
    } catch (err: any) {
      setCode("");
      toast.error(err?.message ?? t("otp_invalid"));
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setLoading(true);
    try {
      if (type === "signup") {
        const { error } = await supabase.auth.resend({ type: "signup", email });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
      }
      setSentAt(Date.now());
      setCode("");
      toast.success(t("otp_resent"));
    } catch (err: any) {
      toast.error(err?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 text-center">
      <MailCheck className="mx-auto h-10 w-10 text-primary" />
      <div>
        <h2 className="text-lg font-bold">{t("otp_title")}</h2>
        <p className="text-sm text-muted-foreground">{t("otp_hint")} <span className="font-medium">{email}</span></p>
      </div>

      <div className="flex justify-center" dir="ltr">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={(v) => {
            setCode(v);
            if (v.length === 6) void verify(v);
          }}
          disabled={loading || expired}
        >
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      <p className={`text-xs ${expired ? "text-destructive" : "text-muted-foreground"}`}>
        {expired ? t("otp_expired") : `${t("otp_expires_in")} ${mm}:${ss}`}
      </p>

      <Button className="w-full" disabled={loading || code.length !== 6 || expired} onClick={() => void verify(code)}>
        {loading ? "..." : t("otp_confirm")}
      </Button>

      <button type="button" onClick={() => void resend()} disabled={loading} className="text-sm text-primary hover:underline">
        {t("otp_resend")}
      </button>
    </div>
  );
}
