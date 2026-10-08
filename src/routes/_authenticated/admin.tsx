import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listUsers, deleteUser, updateOrderStatus, adminReplyMessage, listAdminOrders } from "@/lib/admin.functions";
import { useI18n, formatMoney } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Trash2, Users, Bell, ShoppingBag, ScrollText, Package, MessageCircle, Send, Flag, Tag, Download, Search, FileText } from "lucide-react";
import { toast } from "sonner";
import { normalizeGoogleMapsUrl } from "@/lib/google-maps";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم | Reflect Admin" },
      { name: "description", content: "لوحة تحكم Reflect: إدارة الطلبات والعروض والمستخدمين والرسائل والبلاغات." },
      { property: "og:title", content: "لوحة التحكم | Reflect" },
      { property: "og:description", content: "إدارة الطلبات والعروض والمستخدمين والرسائل والبلاغات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { t, lang } = useI18n();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const qc = useQueryClient();
  const callList = useServerFn(listUsers);
  const callDelete = useServerFn(deleteUser);
  const callUpdateStatus = useServerFn(updateOrderStatus);
  const callReply = useServerFn(adminReplyMessage);
  const callAdminOrders = useServerFn(listAdminOrders);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [orderQuery, setOrderQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [promoForm, setPromoForm] = useState({ title: "", body: "", starts_at: "", ends_at: "" });

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) { setAuthorized(false); return; }
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
      setAuthorized(!!r);
    });
  }, []);

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"], enabled: authorized === true, queryFn: () => callList(),
  });

  const { data: notifs = [] } = useQuery({
    queryKey: ["admin-notifs"], enabled: authorized === true,
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_notifications").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders"], enabled: authorized === true,
    queryFn: async () => (await callAdminOrders()) as any[],
  });

  const { data: productAvail = {} } = useQuery({
    queryKey: ["admin-product-avail", orders.length],
    enabled: orders.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set(orders.flatMap((o: any) => (o.order_items ?? []).map((i: any) => i.product_id).filter(Boolean))));
      if (!ids.length) return {} as Record<string, number>;
      const { data } = await supabase.from("products").select("id,stock").in("id", ids);
      return Object.fromEntries((data ?? []).map((p: any) => [p.id, p.stock]));
    },
  });

  const { data: threads = [] } = useQuery({
    queryKey: ["admin-support-threads"], enabled: authorized === true, refetchInterval: 8000,
    queryFn: async () => {
      const { data, error } = await supabase.from("support_messages")
        .select("user_id, body, created_at, sender_role, read_by_admin")
        .order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      const seen = new Map<string, any>();
      for (const m of data as any[]) {
        if (!seen.has(m.user_id)) seen.set(m.user_id, { user_id: m.user_id, last: m.body, at: m.created_at, unread: 0 });
        const t = seen.get(m.user_id)!;
        if (m.sender_role === "user" && !m.read_by_admin) t.unread++;
      }
      const list = Array.from(seen.values());
      const ids = list.map((l) => l.user_id);
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", ids);
        const map = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
        list.forEach((l) => (l.name = map.get(l.user_id) || l.user_id.slice(0, 8)));
      }
      return list;
    },
  });

  const { data: threadMsgs = [] } = useQuery({
    queryKey: ["admin-thread", openThread], enabled: !!openThread, refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase.from("support_messages")
        .select("id,sender_role,body,created_at,read_by_admin")
        .eq("user_id", openThread!).order("created_at", { ascending: true });
      if (error) throw error;
      const unread = (data as any[]).filter((m) => m.sender_role === "user" && !m.read_by_admin);
      if (unread.length) {
        await supabase.from("support_messages").update({ read_by_admin: true }).in("id", unread.map((m: any) => m.id));
      }
      return data;
    },
  });

  const { data: reports = [] } = useQuery({
    queryKey: ["admin-reports"], enabled: authorized === true,
    queryFn: async () => {
      const { data, error } = await supabase.from("community_reports")
        .select("id,target_type,target_id,reason,created_at").order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data;
    },
  });

  const { data: promos = [] } = useQuery({
    queryKey: ["admin-promos"], enabled: authorized === true,
    queryFn: async () => {
      const { data, error } = await supabase.from("promotions")
        .select("id,title,body,starts_at,ends_at,active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const visibleOrders = (orders as any[]).filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    const ts = new Date(o.created_at).getTime();
    if (dateFrom && ts < new Date(dateFrom).getTime()) return false;
    if (dateTo && ts >= new Date(dateTo).getTime() + 86400000) return false;
    const q = orderQuery.trim().toLowerCase();
    if (!q) return true;
    return [o.customer_name, o.customer_email, o.phone, o.id]
      .filter(Boolean).some((v: string) => String(v).toLowerCase().includes(q));
  });

  function exportCsv() {
    const head = ["order_id", "status", "total", "payment_method", "created_at", "customer_name", "customer_email", "phone"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = visibleOrders.map((o: any) => [
      o.id, o.status, o.total, o.payment_method, o.created_at, o.customer_name ?? "", o.customer_email ?? "", o.phone ?? "",
    ].map(esc).join(","));
    const csv = "\uFEFF" + [head.join(","), ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const rangeLabel = [dateFrom || "…", dateTo || "…"].join(" → ");
    const totalSum = visibleOrders.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
    const rows = visibleOrders.map((o: any) => `
      <tr>
        <td>#${String(o.id).slice(0, 8)}</td>
        <td>${new Date(o.created_at).toLocaleString(locale)}</td>
        <td>${escapeHtml(o.customer_name ?? "")}</td>
        <td>${escapeHtml(o.customer_email ?? "")}</td>
        <td>${escapeHtml(o.phone ?? "")}</td>
        <td>${escapeHtml(o.payment_method ?? "")}</td>
        <td>${escapeHtml(t(`status_${o.status}` as any))}</td>
        <td style="text-align:end">${Number(o.total).toLocaleString(locale)} EGP</td>
      </tr>`).join("");
    const html = `<!doctype html><html dir="${lang === "ar" ? "rtl" : "ltr"}" lang="${lang}"><head>
      <meta charset="utf-8"><title>${t("orders_report")}</title>
      <style>
        body{font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;padding:24px;color:#111}
        h1{font-size:20px;margin:0 0 4px}
        p{margin:0 0 16px;color:#555;font-size:12px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #ddd;padding:6px}
        th{background:#f3f4f6;text-align:start}
        tfoot td{font-weight:700;background:#fafafa}
        @media print{@page{size:A4 landscape;margin:12mm}}
      </style></head><body>
      <h1>${t("orders_report")} — Reflect</h1>
      <p>${rangeLabel} · ${visibleOrders.length} ${t("orders_count")}</p>
      <table><thead><tr>
        <th>ID</th><th>${t("date")}</th><th>${t("full_name")}</th><th>${t("email")}</th>
        <th>${t("phone")}</th><th>${t("payment_method")}</th><th>${t("status")}</th><th>${t("total")}</th>
      </tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><td colspan="7">${t("gross_revenue")}</td><td style="text-align:end">${totalSum.toLocaleString(locale)} EGP</td></tr></tfoot>
      </table>
      <script>window.onload=function(){window.print()}<\/script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("Popup blocked"); return; }
    w.document.write(html);
    w.document.close();
  }

  async function createPromo(e: React.FormEvent) {
    e.preventDefault();
    const { title, body, starts_at, ends_at } = promoForm;
    if (!title.trim() || !ends_at) { toast.error(t("promo_title")); return; }
    const { error } = await supabase.from("promotions").insert({
      title: title.trim(), body: body.trim(),
      starts_at: starts_at ? new Date(starts_at).toISOString() : new Date().toISOString(),
      ends_at: new Date(ends_at).toISOString(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success(t("promo_created"));
    setPromoForm({ title: "", body: "", starts_at: "", ends_at: "" });
    qc.invalidateQueries({ queryKey: ["admin-promos"] });
  }

  async function deletePromo(id: string) {
    const { error } = await supabase.from("promotions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("promo_deleted"));
    qc.invalidateQueries({ queryKey: ["admin-promos"] });
  }

  async function togglePromo(id: string, active: boolean) {
    const { error } = await supabase.from("promotions").update({ active }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-promos"] });
  }

  async function onStatusChange(orderId: string, status: string) {
    try {
      await callUpdateStatus({ data: { orderId, status } });
      toast.success(t("saved"));
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
    } catch (e: any) { toast.error(e.message); }
  }

  async function sendReply() {
    if (!openThread) return;
    const b = replyText.trim();
    if (!b) return;
    try {
      await callReply({ data: { userId: openThread, body: b } });
      setReplyText("");
      qc.invalidateQueries({ queryKey: ["admin-thread", openThread] });
      qc.invalidateQueries({ queryKey: ["admin-support-threads"] });
    } catch (e: any) { toast.error(e.message); }
  }

  async function markAllRead() {
    await supabase.from("admin_notifications").update({ read: true }).eq("read", false);
    qc.invalidateQueries({ queryKey: ["admin-notifs"] });
  }

  useEffect(() => { if (authorized) markAllRead(); /* eslint-disable-next-line */ }, [authorized]);

  async function onDelete(id: string) {
    if (!confirm(t("confirm_delete_user"))) return;
    try {
      await callDelete({ data: { userId: id } });
      toast.success(t("user_deleted"));
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) { toast.error(e.message); }
  }

  if (authorized === null) return <div className="p-10 text-center">{t("loading")}</div>;
  if (!authorized) return <div className="p-10 text-center text-destructive">Forbidden</div>;

  return (
    <div className="mx-auto max-w-5xl px-3 sm:px-4 py-8 space-y-8">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">{t("admin_panel")}</h1>
        <Link to="/audit">
          <Button variant="outline" size="sm"><ScrollText className="h-4 w-4 mx-1" /> {t("audit_log")}</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat icon={<Users className="h-5 w-5" />} label={t("total_users")} value={users.length} />
        <Stat icon={<ShoppingBag className="h-5 w-5" />} label={t("total_orders_all")} value={orders.length} />
        <Stat icon={<Bell className="h-5 w-5" />} label={t("notifications")} value={notifs.length} />
      </div>

      {/* ORDERS */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Package className="h-4 w-4" /> {t("orders_management")}</h2>
        <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute top-1/2 start-2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={orderQuery} onChange={(e) => setOrderQuery(e.target.value)} placeholder={t("search_orders")}
              className="w-full rounded-md border bg-background ps-8 pe-2 py-2 text-sm" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border bg-background px-2 py-2 text-sm">
            <option value="all">{t("all_statuses")}</option>
            {["pending","paid","processing","shipped","delivered","cancelled"].map((s) => (
              <option key={s} value={s}>{t(`status_${s}` as any)}</option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="sk-tap" onClick={exportCsv}><Download className="h-4 w-4 mx-1" /> {t("export_csv")}</Button>
            <Button variant="outline" size="sm" className="sk-tap" onClick={exportPdf}><FileText className="h-4 w-4 mx-1" /> {t("export_pdf")}</Button>
          </div>
        </div>
        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-muted-foreground">
            {t("date_from")}
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="sk-tap mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm text-foreground" />
          </label>
          <label className="text-xs text-muted-foreground">
            {t("date_to")}
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="sk-tap mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm text-foreground" />
          </label>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" className="sk-tap self-end" onClick={() => { setDateFrom(""); setDateTo(""); }}>
              {t("clear_filters")}
            </Button>
          )}
        </div>
        {visibleOrders.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("no_orders")}</p>
        ) : (
          <div className="space-y-3">
            {visibleOrders.map((o: any) => (
              <div key={o.id} className="border rounded-lg bg-card p-4">
                <div className="flex flex-wrap justify-between gap-2 mb-2">
                  <div className="text-xs">
                    <span className="font-mono">#{o.id.slice(0, 8)}</span>
                    <span className="text-muted-foreground mx-2">·</span>
                    <span className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString(locale)}</span>
                    <span className="text-muted-foreground mx-2">·</span>
                    <span>{o.payment_method}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary">{formatMoney(Number(o.total), lang)}</span>
                    <select value={o.status} onChange={(e) => onStatusChange(o.id, e.target.value)}
                      className="rounded-md border bg-background px-2 py-1 text-xs">
                      {["pending","paid","processing","shipped","delivered","cancelled"].map((s) => (
                        <option key={s} value={s}>{t(`status_${s}` as any)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="text-xs bg-muted/40 rounded-md p-2 mb-2 space-y-0.5">
                  <p><span className="text-muted-foreground">👤 </span>{o.customer_name || "—"}</p>
                  <p><span className="text-muted-foreground">✉️ </span>{o.customer_email || "—"}</p>
                  <p><span className="text-muted-foreground">📞 </span>{o.phone || "—"}</p>
                  {o.backup_phone && <p><span className="text-muted-foreground">☎ </span>{o.backup_phone}</p>}
                  <p><span className="text-muted-foreground">📍 </span>{o.shipping_address}</p>
                  {o.google_maps_url && normalizeGoogleMapsUrl(o.google_maps_url) && (
                    <a href={normalizeGoogleMapsUrl(o.google_maps_url) ?? undefined} target="_blank" rel="noreferrer" className="inline-block text-primary underline underline-offset-2">
                      فتح موقع الاستلام على Google Maps
                    </a>
                  )}
                </div>
                <div className="text-xs space-y-1 border-t pt-2">
                  {(o.order_items ?? []).map((i: any, idx: number) => {
                    const stock = i.product_id ? (productAvail as any)[i.product_id] : null;
                    const available = stock === null || stock === undefined ? null : stock > 0;
                    return (
                      <div key={idx} className="flex justify-between gap-2">
                        <span>{i.product_name} × {i.quantity}</span>
                        <span>
                          {available === null ? (
                            <span className="text-muted-foreground">{t("product_removed")}</span>
                          ) : available ? (
                            <span className="text-green-600 dark:text-green-400">✓ {t("in_stock")}</span>
                          ) : (
                            <span className="text-destructive">✕ {t("out_of_stock")}</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
                
              </div>
            ))}
          </div>
        )}
      </section>

      {/* PROMOTIONS */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Tag className="h-4 w-4" /> {t("promotions")}</h2>
        <form onSubmit={createPromo} className="mb-3 grid gap-2 rounded-lg border bg-card p-4 sm:grid-cols-2">
          <input required value={promoForm.title} onChange={(e) => setPromoForm({ ...promoForm, title: e.target.value })}
            placeholder={t("promo_title")} className="rounded-md border bg-background px-2 py-2 text-sm sm:col-span-2" />
          <textarea value={promoForm.body} onChange={(e) => setPromoForm({ ...promoForm, body: e.target.value })}
            placeholder={t("promo_body")} rows={2} className="rounded-md border bg-background px-2 py-2 text-sm sm:col-span-2" />
          <label className="text-xs text-muted-foreground">{t("starts_at")}
            <input type="datetime-local" value={promoForm.starts_at} onChange={(e) => setPromoForm({ ...promoForm, starts_at: e.target.value })}
              className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm" />
          </label>
          <label className="text-xs text-muted-foreground">{t("ends_at")}
            <input type="datetime-local" required value={promoForm.ends_at} onChange={(e) => setPromoForm({ ...promoForm, ends_at: e.target.value })}
              className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm" />
          </label>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" size="sm">{t("create_promo")}</Button>
          </div>
        </form>
        {promos.length > 0 && (
          <div className="divide-y rounded-lg border bg-card">
            {promos.map((p: any) => (
              <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.starts_at).toLocaleDateString(locale)} → {new Date(p.ends_at).toLocaleDateString(locale)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={p.active} onChange={(e) => togglePromo(p.id, e.target.checked)} />
                    {t("active")}
                  </label>
                  <Button variant="destructive" size="sm" onClick={() => deletePromo(p.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MESSAGES */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><MessageCircle className="h-4 w-4" /> {t("customer_messages")}</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="border rounded-lg bg-card divide-y max-h-96 overflow-y-auto">
            {threads.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">{t("no_messages")}</p>
            ) : threads.map((th: any) => (
              <button key={th.user_id} onClick={() => setOpenThread(th.user_id)}
                className={`w-full text-start p-3 hover:bg-accent ${openThread === th.user_id ? "bg-accent" : ""}`}>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">{th.name}</span>
                  {th.unread > 0 && <span className="text-[10px] bg-destructive text-destructive-foreground rounded-full px-1.5">{th.unread}</span>}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">{th.last}</p>
              </button>
            ))}
          </div>
          <div className="border rounded-lg bg-card p-3 flex flex-col max-h-96">
            {!openThread ? (
              <p className="text-sm text-muted-foreground m-auto">{t("select_conversation")}</p>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto space-y-2 mb-2">
                  {(threadMsgs as any[]).map((m) => (
                    <div key={m.id} className={`flex ${m.sender_role === "admin" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-lg px-2 py-1 text-xs ${m.sender_role === "admin" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        <p className="whitespace-pre-wrap">{m.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={replyText} onChange={(e) => setReplyText(e.target.value)}
                    placeholder={t("type_message")} className="flex-1 rounded-md border bg-background px-2 py-1 text-sm" />
                  <Button size="sm" onClick={sendReply}><Send className="h-4 w-4" /></Button>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* REPORTS */}
      {reports.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Flag className="h-4 w-4" /> {t("community_reports")}</h2>
          <div className="border rounded-lg bg-card divide-y">
            {reports.map((r: any) => (
              <div key={r.id} className="p-3 text-sm flex justify-between gap-3">
                <div>
                  <p><span className="font-mono text-xs">{r.target_type}#{r.target_id.slice(0, 8)}</span></p>
                  <p className="text-xs text-muted-foreground">{r.reason || "—"}</p>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString(locale)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* NOTIFS */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Bell className="h-4 w-4" /> {t("notifications")}</h2>
        {notifs.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("no_notifications")}</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {notifs.map((n: any) => (
              <div key={n.id} className="border rounded-md p-3 bg-card text-sm flex justify-between gap-3">
                <div>
                  <p>{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString(locale)}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-muted h-fit shrink-0">{n.kind}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* USERS */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Users className="h-4 w-4" /> {t("users")}</h2>
        <div className="border rounded-lg overflow-x-auto bg-card">
          <table className="w-full min-w-[32rem] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">{t("full_name")}</th>
                <th className="p-3">{t("email")}</th>
                <th className="p-3">{t("registered")}</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-3">{u.full_name || "-"}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString(locale)}</td>
                  <td className="p-3 text-right">
                    <Button variant="destructive" size="sm" onClick={() => onDelete(u.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="border rounded-lg p-5 bg-card flex items-center gap-4">
      <div className="rounded-full bg-primary/10 p-3 text-primary">{icon}</div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function escapeHtml(v: unknown) {
  return String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}
