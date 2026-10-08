import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompare } from "@/lib/compare";
import { useI18n, formatMoney } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Stars } from "@/components/stars";
import { type Product, finalPrice, coverImage, sizeList, availableStock } from "@/components/product-card";

export const Route = createFileRoute("/_authenticated/compare")({
  head: () => ({
    meta: [
      { title: "قارن المنتجات | Reflect" },
      { name: "description", content: "قارن بين منتجات Reflect في السعر والمقاسات والتقييم والمخزون." },
      { property: "og:title", content: "قارن المنتجات | Reflect" },
      { property: "og:description", content: "قارن بين منتجات Reflect جنب بعض." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  const { ids, remove, clear } = useCompare();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data = [], isLoading } = useQuery({
    queryKey: ["compare", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").in("id", ids);
      if (error) throw error;
      return (data as unknown as Product[]).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    },
  });

  if (!ids.length) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-4xl mb-3">⚖️</p>
        <h1 className="text-xl font-bold mb-2">{ar ? "مفيش حاجة للمقارنة لسه" : "Nothing to compare yet"}</h1>
        <p className="text-muted-foreground mb-6">{ar ? "دوس على ⚖️ في أي منتج عشان تضيفه هنا (لحد 4 منتجات)." : "Tap ⚖️ on any product to add it (up to 4)."}</p>
        <Link to="/"><Button>{ar ? "يلا نتفرج 🔥" : "Browse products 🔥"}</Button></Link>
      </div>
    );
  }

  const rows: { label: string; render: (p: Product) => React.ReactNode }[] = [
    { label: ar ? "السعر" : "Price", render: (p) => <span className="font-bold text-primary">{formatMoney(finalPrice(p), lang)}</span> },
    { label: ar ? "الخصم" : "Discount", render: (p) => (p.discount_percent > 0 ? `-${p.discount_percent}%` : "—") },
    { label: ar ? "التقييم" : "Rating", render: (p) => p.rating_count > 0
      ? <span className="flex items-center gap-1"><Stars value={Number(p.rating_avg)} /> {Number(p.rating_avg).toFixed(1)} / 5 ({p.rating_count})</span>
      : <span className="text-muted-foreground">{ar ? "مفيش تقييمات" : "No ratings"}</span> },
    { label: ar ? "المقاسات" : "Sizes", render: (p) => sizeList(p).filter((s) => s.stock > 0).map((s) => s.size).join(" · ") || "—" },
    { label: ar ? "المخزون" : "Stock", render: (p) => { const s = availableStock(p); return s > 0 ? s : <span className="text-destructive">{ar ? "خلص" : "Out"}</span>; } },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{ar ? "قارن ⚖️" : "Compare ⚖️"}</h1>
        <Button variant="outline" size="sm" onClick={clear}>{ar ? "امسح الكل" : "Clear all"}</Button>
      </div>
      {isLoading ? <p className="text-muted-foreground">...</p> : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr>
                <th className="p-3 w-28" />
                {data.map((p) => (
                  <th key={p.id} className="p-3 align-top text-start">
                    <div className="relative">
                      <button onClick={() => remove(p.id)} aria-label="remove" className="absolute -top-1 -end-1 h-7 w-7 rounded-full bg-background border flex items-center justify-center"><X className="h-4 w-4" /></button>
                      <Link to="/product/$id" params={{ id: p.id }}>
                        <div className="aspect-square rounded-lg bg-muted overflow-hidden mb-2">
                          {coverImage(p) && <img src={coverImage(p)!} alt={p.name} className="h-full w-full object-cover" />}
                        </div>
                        <p className="font-semibold line-clamp-2">{p.name}</p>
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t">
                  <td className="p-3 font-medium text-muted-foreground">{r.label}</td>
                  {data.map((p) => <td key={p.id} className="p-3">{r.render(p)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
