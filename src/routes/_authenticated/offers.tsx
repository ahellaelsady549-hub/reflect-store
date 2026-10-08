import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { ProductCard, type Product } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Tag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/offers")({
  head: () => ({
    meta: [
      { title: "العروض | Reflect Offers" },
      { name: "description", content: "كل العروض والخصومات السارية حالياً على منتجات Reflect بالجنيه المصري." },
      { property: "og:title", content: "العروض | Reflect" },
      { property: "og:description", content: "كل العروض والخصومات السارية حالياً على منتجات Reflect." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OffersPage,
});

function OffersPage() {
  const { t, lang } = useI18n();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";

  const { data: promos = [] } = useQuery({
    queryKey: ["active-promos"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase.from("promotions")
        .select("id,title,body,starts_at,ends_at")
        .eq("active", true).lte("starts_at", now).gte("ends_at", now)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["offer-products"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase.from("products").select("*")
        .gt("discount_percent", 0).order("discount_percent", { ascending: false });
      if (error) throw error;
      return data as unknown as Product[];
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-4 flex items-center gap-2 text-xl font-bold sm:text-2xl">
        <Tag className="h-5 w-5 shrink-0 text-primary" /> {t("offers_page_title")}
      </h1>

      {promos.length > 0 && (
        <div className="mb-6 space-y-3">
          {promos.map((p) => (
            <div key={p.id} className="rounded-xl border border-primary/40 bg-primary/5 p-4">
              <h2 className="font-bold">{p.title}</h2>
              {p.body && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{p.body}</p>}
              <p className="mt-2 text-xs text-muted-foreground">
                {t("offer_from")} {new Date(p.starts_at).toLocaleDateString(locale)} · {t("offer_valid_until")}{" "}
                {new Date(p.ends_at).toLocaleDateString(locale)}
              </p>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="py-10 text-center text-muted-foreground">{t("loading")}</p>
      ) : products.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-muted-foreground">{t("no_offers")}</p>
          <Link to="/"><Button variant="outline" className="mt-4">{t("back_to_shop")}</Button></Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
