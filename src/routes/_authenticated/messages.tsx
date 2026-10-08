import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

function MessagesPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const { data: msgs = [] } = useQuery({
    queryKey: ["support-messages", uid],
    enabled: !!uid,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("id,sender_role,body,created_at,read_by_user")
        .eq("user_id", uid!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      // mark admin messages as read
      const unread = (data || []).filter((m: any) => m.sender_role === "admin" && !m.read_by_user);
      if (unread.length) {
        await supabase.from("support_messages").update({ read_by_user: true }).in("id", unread.map((m: any) => m.id));
      }
      return data;
    },
  });

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const b = body.trim();
    if (!b || !uid) return;
    setBody("");
    const { error } = await supabase.from("support_messages").insert({
      user_id: uid, sender_role: "user", body: b,
    });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["support-messages", uid] });
  }

  const locale = lang === "ar" ? "ar-EG" : "en-GB";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">{t("messages")}</h1>
      <div ref={boxRef} className="border rounded-xl bg-card p-4 h-[60vh] overflow-y-auto space-y-2">
        {msgs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">{t("no_messages")}</p>
        ) : msgs.map((m: any) => (
          <div key={m.id} className={`flex ${m.sender_role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.sender_role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className="text-[10px] opacity-70 mt-1">{new Date(m.created_at).toLocaleString(locale)}</p>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("type_message")}
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          maxLength={4000}
        />
        <Button type="submit" size="sm"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}
