import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAdmin } from "@/hooks/use-admin";
import { ScrollText, Plus, Trash2, Pencil, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/audit")({
  component: AuditPage,
});

type LogRow = {
  id: string;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  created_at: string;
};

function actionIcon(action: string) {
  if (action === "create") return <Plus className="h-4 w-4" />;
  if (action === "delete") return <Trash2 className="h-4 w-4" />;
  if (action === "update") return <Pencil className="h-4 w-4" />;
  return <UserIcon className="h-4 w-4" />;
}

function actionColor(action: string) {
  if (action === "create") return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300";
  if (action === "delete") return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  if (action === "update") return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
  return "bg-muted";
}

function AuditPage() {
  const { t, lang } = useI18n();
  const { isAdmin } = useAdmin();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["admin-audit"],
    enabled: isAdmin,
    queryFn: async (): Promise<LogRow[]> => {
      const { data, error } = await supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as LogRow[];
    },
  });

  if (!isAdmin) return <div className="p-10 text-center text-destructive">Forbidden</div>;

  const locale = lang === "ar" ? "ar-EG" : "en-GB";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScrollText className="h-6 w-6" /> {t("audit_log")}
        </h1>
        <Link to="/admin" className="text-sm text-primary hover:underline">← {t("admin_panel")}</Link>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">{t("loading")}</p>
      ) : logs.length === 0 ? (
        <div className="border rounded-lg p-10 text-center bg-card text-muted-foreground">
          {t("no_audit_entries")}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-start">
              <tr>
                <th className="p-3 text-start">{t("date")}</th>
                <th className="p-3 text-start">{t("actor")}</th>
                <th className="p-3 text-start">{t("action")}</th>
                <th className="p-3 text-start">{t("entity")}</th>
                <th className="p-3 text-start">{t("details")}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t align-top">
                  <td className="p-3 whitespace-nowrap text-muted-foreground">
                    {new Date(l.created_at).toLocaleString(locale)}
                  </td>
                  <td className="p-3">{l.actor_email || "-"}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${actionColor(l.action)}`}>
                      {actionIcon(l.action)} {t(`audit_${l.action}` as any) || l.action}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="font-mono text-xs">{t(`entity_${l.entity_type}` as any) || l.entity_type}</span>
                    {l.entity_id && <div className="text-xs text-muted-foreground font-mono">{l.entity_id.slice(0, 8)}</div>}
                  </td>
                  <td className="p-3">
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all max-w-md">
                      {l.details ? JSON.stringify(l.details, null, 0) : "-"}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
