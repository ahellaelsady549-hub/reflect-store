import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/use-admin";
import { useI18n, formatMoney } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Boxes, Search, AlertTriangle, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: InventoryPage,
  head: () => ({
    meta: [
      { title: "المخزون | Reflect" },
      { name: "description", content: "إدارة مخزون منتجات Reflect: الكميات المتاحة والمقاسات والتنبيه عند قرب النفاد." },
      { property: "og:title", content: "المخزون | Reflect" },
      { property: "og:description", content: "إدارة كميات المنتجات والمقاسات والمخزون المنخفض." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Sz = { size: string; stock: number };
type Prod = {
  id: string; name: string; category: string; price: number;
  stock: number; sizes: Sz[] | null; image_url: string | null;
};

function InventoryPage() {
  const { isAdmin } = useAdmin();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["inventory-products"],
    enabled: isAdmin,
    queryFn: async (): Promise<Prod[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,category,price,stock,sizes,image_url")
        .order("stock", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Prod[];
    },
  });

  const filtered = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())),
    [products, q],
  );

  const totals = useMemo(() => {
    const units = products.reduce((s, p) => s + Number(p.stock || 0), 0);
    const value = products.reduce((s, p) => s + Number(p.stock || 0) * Number(p.price || 0), 0);
    const low = products.filter((p) => Number(p.stock || 0) > 0 && Number(p.stock) <= 5).length;
    return { units, value, low };
  }, [products]);

  async function saveStock(p: Prod) {
    const raw = edits[p.id];
    if (raw === undefined) return;
    const next = Math.max(0, Number(raw) || 0);
    const { error } = await supabase.from("products").update({ stock: next }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("stock_updated"));
    setEdits((e) => { const c = { ...e }; delete c[p.id]; return c; });
    qc.invalidateQueries({ queryKey: ["inventory-products"] });
  }

  if (!isAdmin) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">403</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <Boxes className="h-6 w-6 text-primary" /> {t("inventory")}
      </h1>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Card label={t("products_count")} value={String(products.length)} icon={<Package className="h-5 w-5 text-primary" />} />
        <Card label={t("total_stock")} value={String(totals.units)} icon={<Boxes className="h-5 w-5 text-primary" />} />
        <Card label={t("stock_value")} value={formatMoney(totals.value, lang)} icon={<Package className="h-5 w-5 text-primary" />} />
        <Card label={t("low_stock")} value={String(totals.low)} icon={<AlertTriangle className="h-5 w-5 text-amber-500" />} />
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-1/2 start-2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search_products")} className="ps-8" />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">{t("loading")}</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">{t("no_products")}</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const stock = Number(p.stock || 0);
            const sizes = Array.isArray(p.sizes) ? p.sizes : [];
            return (
              <div key={p.id} className="rounded-lg border bg-card p-3">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                    {p.image_url && <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.category} · {formatMoney(Number(p.price), lang)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${
                      stock === 0
                        ? "bg-destructive/10 text-destructive"
                        : stock <= 5
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : "bg-primary/10 text-primary"
                    }`}
                  >
                    {stock === 0 ? t("out_of_stock_label") : `${stock} ${t("in_stock_label")}`}
                  </span>
                </div>

                {sizes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t pt-2">
                    {sizes.map((s) => (
                      <span key={s.size} className={`rounded-md border px-2 py-0.5 text-[11px] ${Number(s.stock) === 0 ? "text-muted-foreground line-through" : ""}`}>
                        {s.size}: {s.stock}
                      </span>
                    ))}
                  </div>
                )}

                {sizes.length === 0 && (
                  <div className="mt-2 flex items-center gap-2 border-t pt-2">
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className="h-9 w-28"
                      value={edits[p.id] ?? String(stock)}
                      onChange={(e) => setEdits((x) => ({ ...x, [p.id]: e.target.value }))}
                    />
                    <Button size="sm" className="sk-tap" onClick={() => saveStock(p)} disabled={edits[p.id] === undefined}>
                      {t("update_stock")}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Card({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
