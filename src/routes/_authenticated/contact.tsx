import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/contact")({
  head: () => ({
    meta: [
      { title: "تواصل معنا - Reflect" },
      { name: "description", content: "أرسل رسالتك لإدارة المتجر وسنرد عليك في أقرب وقت." },
      { property: "og:title", content: "Contact - Reflect" },
      { property: "og:description", content: "Reach the shop admin directly." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const b = body.trim();
    if (b.length < 3) { toast.error(t("message_too_short")); return; }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("support_messages").insert({
        user_id: u.user.id, sender_role: "user", body: b,
      });
      if (error) throw error;
      toast.success(t("message_sent"));
      setBody("");
      navigate({ to: "/messages" });
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 space-y-4">
      <h1 className="text-2xl font-bold">{t("contact")}</h1>
      <p className="text-sm text-muted-foreground">{t("contact_hint")}</p>
      <form onSubmit={send} className="space-y-3 border rounded-xl bg-card p-5">
        <Label>{t("your_message")}</Label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          maxLength={4000}
          required
          className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-y"
          placeholder={t("your_message")}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>{busy ? "..." : t("send")}</Button>
        </div>
      </form>
    </div>
  );
}
