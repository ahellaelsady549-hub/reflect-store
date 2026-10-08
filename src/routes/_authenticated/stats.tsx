import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/use-admin";
import { useI18n, formatMoney } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, TrendingUp, CalendarDays, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/stats")({
  component: StatsPage,
  head: () => ({
    meta: [
      { title: "إحصائيات المبيعات | Reflect" },
      { name: "description", content: "إيراد اليوم والشهر وأفضل المنتجات مبيعًا في متجر Reflect." },
      { property: "og:title", content: "إحصائيات المبيعات | Reflect" },
      { property: "og:description", content: "إيراد اليوم والشهر وأفضل المنتجات مبيعًا." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type OrderRow = {
  id: string;
  total: number;
  status: string;
  created_at: string;
  order_items: { product_name: string; unit_price: number; quantity: number }[];
};

function StatsPage() {
  const { isAdmin } = useAdmin();
  const { t, lang } = useI18n();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-stats-orders"],
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,total,status,created_at,order_items(product_name,unit_price,quantity)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as OrderRow[];
    },
    enabled: isAdmin,
  });

  const paid = useMemo(() => orders.filter((o) => o.status !== "cancelled"), [orders]);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const revenueToday = paid
    .filter((o) => new Date(o.created_at).getTime() >= startOfToday)
    .reduce((s, o) => s + Number(o.total), 0);
  const revenueMonth = paid
    .filter((o) => new Date(o.created_at).getTime() >= startOfMonth)
    .reduce((s, o) => s + Number(o.total), 0);

  const ranged = useMemo(() => {
    const f = from ? new Date(from).getTime() : -Infinity;
    const tt = to ? new Date(to).getTime() + 86400000 : Infinity;
    return paid.filter((o) => {
      const d = new Date(o.created_at).getTime();
      return d >= f && d < tt;
    });
  }, [paid, from, to]);

  const rangeRevenue = ranged.reduce((s, o) => s + Number(o.total), 0);

  const topProducts = useMemo(() => {
    const map = new Map<string, { qty: number; revenue: number }>();
    for (const o of ranged) {
      for (const i of o.order_items ?? []) {
        const cur = map.get(i.product_name) ?? { qty: 0, revenue: 0 };
        cur.qty += i.quantity;
        cur.revenue += Number(i.unit_price) * i.quantity;
        map.set(i.product_name, cur);
      }
    }
    return [...map.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [ranged]);

  if (!isAdmin) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">403</div>;
  }

  const maxQty = topProducts[0]?.qty ?? 1;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <BarChart3 className="h-6 w-6 text-primary" /> {t("stats")}
      </h1>

      {isLoading ? (
        <p className="text-muted-foreground">{t("loading")}</p>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard icon={<CalendarDays className="h-5 w-5 text-primary" />} label={t("revenue_today")} value={formatMoney(revenueToday, lang)} />
            <StatCard icon={<TrendingUp className="h-5 w-5 text-primary" />} label={t("revenue_month")} value={formatMoney(revenueMonth, lang)} />
            <StatCard icon={<Package className="h-5 w-5 text-primary" />} label={t("total_orders_all")} value={String(paid.length)} />
          </div>

          <div className="mb-6 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="f">{t("from")}</Label>
              <Input id="f" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="tt">{t("to")}</Label>
              <Input id="tt" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="flex flex-col justify-end">
              <p className="text-sm text-muted-foreground">{t("revenue_range")}</p>
              <p className="text-xl font-bold text-primary">{formatMoney(rangeRevenue, lang)}</p>
              <p className="text-xs text-muted-foreground">{t("orders_count")}: {ranged.length}</p>
            </div>
          </div>

          <h2 className="mb-3 text-xl font-bold">{t("top_products")}</h2>
          {topProducts.length === 0 ? (
            <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">{t("no_sales")}</p>
          ) : (
            <div className="space-y-2 rounded-lg border bg-card p-4">
              {topProducts.map((p) => (
                <div key={p.name} className="space-y-1">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate">{p.name}</span>
                    <span className="whitespace-nowrap text-muted-foreground">
                      {p.qty} {t("units")} · {formatMoney(p.revenue, lang)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${Math.max(4, (p.qty / maxQty) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-5">
      <div className="rounded-full bg-primary/10 p-3">{icon}</div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}
