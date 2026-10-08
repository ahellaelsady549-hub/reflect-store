import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "إشعاراتي | Reflect Notifications" },
      { name: "description", content: "تابع تحديثات حالة طلباتك وإشعارات حسابك في Reflect." },
      { property: "og:title", content: "إشعاراتي | Reflect" },
      { property: "og:description", content: "تابع تحديثات حالة طلباتك وإشعارات حسابك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { t, lang } = useI18n();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["my-notifications"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_notifications")
        .select("id,title,body,read,created_at")
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data as any[];
    },
  });

  async function markAll() {
    await supabase.from("user_notifications").update({ read: true }).eq("read", false);
    qc.invalidateQueries({ queryKey: ["my-notifications"] });
  }

  useEffect(() => {
    if (items.some((n) => !n.read)) markAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h1 className="flex min-w-0 items-center gap-2 truncate text-xl font-bold">
          <Bell className="h-5 w-5 shrink-0" /> {t("notifications_mine")}
        </h1>
        <Button variant="outline" size="sm" onClick={markAll}>
          <CheckCheck className="mx-1 h-4 w-4" /> {t("mark_all_read")}
        </Button>
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-muted-foreground">{t("loading")}</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">{t("no_notifications_mine")}</p>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <div key={n.id} className={`rounded-lg border p-3 ${n.read ? "bg-card" : "border-primary/40 bg-primary/5"}`}>
              <p className="text-sm font-semibold">{n.title}</p>
              <p className="text-sm text-muted-foreground">{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString(locale)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
