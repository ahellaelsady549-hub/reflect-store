import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/use-admin";
import { useI18n, formatMoney } from "@/lib/i18n";
import { Wallet, TrendingUp, CalendarDays, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/earnings")({
  component: EarningsPage,
  head: () => ({
    meta: [
      { title: "الأرباح | Reflect" },
      { name: "description", content: "إجمالي أرباح Reflect أسبوعيًا وشهريًا وسنويًا مع تفصيل الإيراد لكل شهر." },
      { property: "og:title", content: "الأرباح | Reflect" },
      { property: "og:description", content: "أرباح المتجر أسبوعيًا وشهريًا وسنويًا." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = { id: string; total: number; status: string; created_at: string };

const MARGIN = 0.3; // estimated net margin used for profit projection

function EarningsPage() {
  const { isAdmin } = useAdmin();
  const { t, lang } = useI18n();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const [margin, setMargin] = useState(MARGIN);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["earnings-orders"],
    enabled: isAdmin,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,total,status,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const valid = useMemo(() => orders.filter((o) => o.status !== "cancelled"), [orders]);

  const now = new Date();
  const startWeek = (() => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() - ((d.getDay() + 1) % 7)); // week starts Saturday (Egypt)
    return d.getTime();
  })();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startYear = new Date(now.getFullYear(), 0, 1).getTime();

  const sum = (from: number) =>
    valid.filter((o) => new Date(o.created_at).getTime() >= from).reduce((s, o) => s + Number(o.total), 0);

  const week = sum(startWeek);
  const month = sum(startMonth);
  const year = sum(startYear);
  const ordersYear = valid.filter((o) => new Date(o.created_at).getTime() >= startYear).length;

  const monthly = useMemo(() => {
    const arr = Array.from({ length: 12 }, (_, i) => ({ i, revenue: 0 }));
    for (const o of valid) {
      const d = new Date(o.created_at);
      if (d.getFullYear() === now.getFullYear()) arr[d.getMonth()].revenue += Number(o.total);
    }
    return arr;
  }, [valid, now]);

  const maxMonthly = Math.max(1, ...monthly.map((m) => m.revenue));

  if (!isAdmin) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">403</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <Wallet className="h-6 w-6 text-primary" /> {t("earnings")}
      </h1>

      {isLoading ? (
        <p className="text-muted-foreground">{t("loading")}</p>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card icon={<CalendarDays className="h-5 w-5 text-primary" />} label={t("revenue_week")} value={formatMoney(week, lang)} />
            <Card icon={<TrendingUp className="h-5 w-5 text-primary" />} label={t("revenue_month")} value={formatMoney(month, lang)} />
            <Card icon={<TrendingUp className="h-5 w-5 text-primary" />} label={t("revenue_year")} value={formatMoney(year, lang)} />
            <Card icon={<ShoppingBag className="h-5 w-5 text-primary" />} label={t("avg_order")} value={formatMoney(ordersYear ? year / ordersYear : 0, lang)} />
          </div>

          <div className="mb-6 rounded-lg border bg-card p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">{t("net_profit")}</span>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                {Math.round(margin * 100)}%
                <input
                  type="range" min={5} max={80} step={5}
                  value={Math.round(margin * 100)}
                  onChange={(e) => setMargin(Number(e.target.value) / 100)}
                  className="sk-tap w-40 accent-[var(--color-primary)]"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Mini label={t("revenue_week")} value={formatMoney(week * margin, lang)} />
              <Mini label={t("revenue_month")} value={formatMoney(month * margin, lang)} />
              <Mini label={t("revenue_year")} value={formatMoney(year * margin, lang)} />
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("gross_revenue")} — {now.getFullYear()}</h2>
            <div className="space-y-2">
              {monthly.map((m) => (
                <div key={m.i} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-2 text-xs">
                  <span className="truncate text-muted-foreground">
                    {new Date(now.getFullYear(), m.i, 1).toLocaleDateString(locale, { month: "short" })}
                  </span>
                  <div className="h-2.5 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(m.revenue / maxMonthly) * 100}%` }} />
                  </div>
                  <span className="whitespace-nowrap font-medium">{formatMoney(m.revenue, lang)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Card({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-bold text-primary">{value}</p>
    </div>
  );
}
