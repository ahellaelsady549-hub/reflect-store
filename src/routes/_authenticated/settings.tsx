import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount, notifyAccountChange } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { LogOut, Trash2, Eye, EyeOff } from "lucide-react";
import { useAdmin } from "@/hooks/use-admin";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useI18n();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const callDeleteMe = useServerFn(deleteMyAccount);
  const callNotifyChange = useServerFn(notifyAccountChange);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      if (!u) return;
      setUserId(u.id); setEmail(u.email ?? ""); setNewEmail(u.email ?? "");
      const { data: p } = await supabase.from("profiles").select("full_name").eq("id", u.id).maybeSingle();
      setName(p?.full_name ?? "");
    });
  }, []);

  async function saveName() {
    if (!userId) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", userId);
      if (error) throw error;
      toast.success(t("saved"));
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function saveEmail() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      await callNotifyChange({ data: { kind: "email_change" } });
      toast.success(t("saved"));
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function savePassword() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await callNotifyChange({ data: { kind: "password_change" } });
      setPassword("");
      toast.success(t("saved"));
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  async function deleteAccount() {
    if (!confirm(t("confirm_delete_account"))) return;
    if (!confirm(t("confirm_delete_account_2"))) return;
    setBusy(true);
    try {
      await callDeleteMe();
      await supabase.auth.signOut();
      toast.success(t("account_deleted"));
      navigate({ to: "/auth" });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">{t("settings")}</h1>

      <section className="border rounded-lg p-5 bg-card space-y-3">
        <Label>{t("full_name")}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
        <Button onClick={saveName} disabled={busy} size="sm">{t("change_name")}</Button>
      </section>

      <section className="border rounded-lg p-5 bg-card space-y-3">
        <Label>{t("email")}</Label>
        <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        <Button onClick={saveEmail} disabled={busy || newEmail === email} size="sm">{t("change_email")}</Button>
      </section>

      <section className="border rounded-lg p-5 bg-card space-y-3">
        <Label>{t("new_password")}</Label>
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            className="pr-10"
          />
          <button
            type="button"
            aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Button onClick={savePassword} disabled={busy || password.length < 6} size="sm">{t("change_password")}</Button>
      </section>

      <section className="border rounded-lg p-5 bg-card space-y-3">
        <Button variant="outline" onClick={signOut}>
          <LogOut className="h-4 w-4 mx-1" /> {t("sign_out")}
        </Button>
      </section>

      {!isAdmin && (
      <section className="border border-destructive/40 rounded-lg p-5 bg-card space-y-3">
        <h2 className="font-semibold text-destructive">{t("danger_zone")}</h2>
        <p className="text-xs text-muted-foreground">{t("delete_account_hint")}</p>
        <Button variant="destructive" onClick={deleteAccount} disabled={busy}>
          <Trash2 className="h-4 w-4 mx-1" /> {t("delete_account")}
        </Button>
      </section>
      )}
    </div>
  );
}
