import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { useI18n, formatMoney, categoryLabel } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Stars, StarsInput } from "@/components/stars";
import { ProductReviews } from "@/components/product-reviews";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Minus, Plus, ArrowRight, ArrowLeft } from "lucide-react";
import { sanitizeImageUrl } from "@/lib/image-safety";

export const Route = createFileRoute("/product/$id")({
  head: () => ({
    meta: [
      { title: "تفاصيل المنتج | Reflect" },
      { name: "description", content: "تفاصيل المنتج، المقاسات، السعر بعد الخصم وتقييمات العملاء الحقيقية في Reflect." },
      { property: "og:title", content: "تفاصيل المنتج | Reflect" },
      { property: "og:description", content: "تفاصيل المنتج، الألوان المتاحة، السعر بعد الخصم والتقييمات." },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const [qty, setQty] = useState(1);
  const { add } = useCart();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [myRating, setMyRating] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [activeSize, setActiveSize] = useState<string | null>(null);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        supabase.from("product_ratings").select("stars").eq("product_id", id).eq("user_id", uid).maybeSingle()
          .then(({ data }) => { if (data) setMyRating(data.stars); });
      }
    });
  }, [id]);

  async function saveRating(stars: number) {
    if (!userId) return;
    setSaving(true);
    setMyRating(stars);
    try {
      const { error } = await supabase.from("product_ratings").upsert(
        { product_id: id, user_id: userId, stars },
        { onConflict: "product_id,user_id" },
      );
      if (error) throw error;
      toast.success(t("rating_saved"));
      await qc.invalidateQueries({ queryKey: ["product", id] });
      await qc.invalidateQueries({ queryKey: ["products"] });
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <div className="p-10 text-center">{t("loading")}</div>;
  if (!product) return <div className="p-10 text-center">{t("product_not_found")}</div>;

  const sizes: { size: string; stock: number }[] = Array.isArray((product as any).sizes) ? ((product as any).sizes as any[]) : [];
  const totalStock = sizes.length
    ? sizes.reduce((a, x) => a + Math.max(0, Number(x.stock) || 0), 0)
    : Number((product as any).stock ?? 0);
  const selected = sizes.find((s) => s.size === activeSize) ?? null;
  const availableForSelection = sizes.length ? Number(selected?.stock ?? 0) : totalStock;
  const soldOut = totalStock <= 0;
  const finalPrice = Number(product.price) * (1 - product.discount_percent / 100);
  const BackIcon = lang === "ar" ? ArrowRight : ArrowLeft;

  const gallery: { url: string; color?: string | null }[] =
    Array.isArray((product as any).images) && (product as any).images.length
      ? ((product as any).images as any[]).map((g: any) => ({ ...g, url: sanitizeImageUrl(g?.url) ?? "" })).filter((g) => g.url)
      : product.image_url
        ? [{ url: sanitizeImageUrl(product.image_url) ?? "", color: null }].filter((g) => g.url)
        : [];
  const colors = Array.from(new Set(gallery.map((g) => g.color).filter(Boolean))) as string[];
  const shown = activeColor ? gallery.filter((g) => g.color === activeColor) : gallery;
  const mainImage = shown[activeImage]?.url ?? shown[0]?.url ?? null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <BackIcon className="h-4 w-4" /> {t("back_to_shop")}
      </Link>
      <div className="grid gap-6 md:grid-cols-2 md:gap-8">
        <div>
          <div className="aspect-square overflow-hidden rounded-xl bg-muted">
            {mainImage && <img src={mainImage} alt={product.name} fetchPriority="high" decoding="async" className="h-full w-full object-cover" />}
          </div>
          {shown.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
              {shown.map((g, i) => (
                <button key={i} onClick={() => setActiveImage(i)}
                  className={`overflow-hidden rounded-md border-2 ${i === activeImage ? "border-primary" : "border-transparent"}`}>
                  <img src={g.url} alt="" loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {colors.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold">{t("colors")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => { setActiveColor(null); setActiveImage(0); }}
                  className={`rounded-full border px-3 py-1 text-xs ${activeColor === null ? "border-primary bg-primary/10" : ""}`}>
                  {t("all")}
                </button>
                {colors.map((c) => (
                  <button key={c} onClick={() => { setActiveColor(c); setActiveImage(0); }}
                    aria-label={c} title={c}
                    className={`h-8 w-8 rounded-full border-2 ${activeColor === c ? "border-primary ring-2 ring-primary/40" : "border-border"}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <p className="text-sm text-muted-foreground mb-2">{categoryLabel(product.category, lang)}</p>
          <h1 className="text-3xl font-bold mb-3">{product.name}</h1>
          <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
            <Stars value={Number(product.rating_avg)} size={18} />
            <span>{Number(product.rating_avg).toFixed(1)} · {product.rating_count} {t("reviews")}</span>
          </div>
          <p className="text-muted-foreground mb-6">{product.description}</p>
          <div className="flex items-baseline gap-3 mb-6">
            <span className="text-3xl font-bold text-primary">{formatMoney(finalPrice, lang)}</span>
            {product.discount_percent > 0 && (
              <>
                <span className="text-lg text-muted-foreground line-through">{formatMoney(Number(product.price), lang)}</span>
                <span className="rounded-full bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1">
                  {t("discount")} {product.discount_percent}%
                </span>
              </>
            )}
          </div>
          {sizes.length > 0 && (
            <div className="mb-6">
              <p className="mb-2 text-sm font-semibold">{t("sizes")}</p>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => {
                  const out = Number(s.stock) <= 0;
                  return (
                    <button key={s.size} type="button" disabled={out}
                      onClick={() => { setActiveSize(s.size); setQty(1); }}
                      className={`rounded-md border px-3 py-1.5 text-sm transition ${activeSize === s.size ? "border-primary bg-primary/10 font-semibold" : ""} ${out ? "cursor-not-allowed opacity-40 line-through" : "hover:bg-accent"}`}>
                      {s.size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className={`mb-4 text-sm ${soldOut ? "text-destructive" : availableForSelection <= 5 && (sizes.length === 0 || activeSize) ? "text-amber-600" : "text-green-600"}`}>
            {t("availability")}: {soldOut
              ? t("out_of_stock")
              : sizes.length && !activeSize
                ? `${t("in_stock_n")} · ${totalStock} ${t("units")}`
                : availableForSelection <= 0
                  ? t("out_of_stock")
                  : `${t("in_stock_n")} · ${availableForSelection} ${t("units")}`}
          </p>

          <div className="flex items-center gap-3 mb-6">
            <span className="text-sm">{t("quantity")}:</span>
            <div className="flex items-center border rounded-md">
              <Button variant="ghost" size="icon" onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></Button>
              <span className="w-10 text-center">{qty}</span>
              <Button variant="ghost" size="icon" disabled={availableForSelection > 0 && qty >= availableForSelection} onClick={() => setQty((q) => (availableForSelection > 0 ? Math.min(availableForSelection, q + 1) : q + 1))}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
          <Button size="lg" disabled={soldOut || (sizes.length > 0 && availableForSelection <= 0)}
            onClick={() => {
              if (sizes.length > 0 && !activeSize) { toast.error(t("size_required")); return; }
              if (qty > availableForSelection) { toast.error(t("qty_exceeds_stock")); return; }
              add({
                id: product.id, name: product.name, price: finalPrice,
                image_url: mainImage ?? product.image_url,
                size: activeSize, max: availableForSelection,
              }, qty);
              toast.success(t("added_to_cart"));
            }}>
            {soldOut ? t("out_of_stock") : t("add_to_cart")}
          </Button>

        </div>
      </div>
      <ProductReviews productId={id} />
    </div>
  );
}
