import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { ProductCard, type Product } from "@/components/product-card";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/wishlist")({
  head: () => ({
    meta: [
      { title: "المفضلة | Reflect" },
      { name: "description", content: "المنتجات التي حفظتها في قائمة المفضلة داخل Reflect، محفوظة مع حسابك." },
      { property: "og:title", content: "المفضلة | Reflect" },
      { property: "og:description", content: "المنتجات المحفوظة في قائمة المفضلة الخاصة بك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WishlistPage,
});

function WishlistPage() {
  const { t } = useI18n();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["wishlist-products"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("wishlists")
        .select("product_id, products(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .map((r: any) => r.products)
        .filter(Boolean) as Product[];
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <Heart className="h-6 w-6 text-destructive" /> {t("wishlist")}
      </h1>
      {isLoading ? (
        <p className="py-10 text-center text-muted-foreground">{t("loading")}</p>
      ) : products.length === 0 ? (
        <div className="py-16 text-center">
          <p className="mb-4 text-muted-foreground">{t("wishlist_empty")}</p>
          <Link to="/"><Button>{t("browse")}</Button></Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
