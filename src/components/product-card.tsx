import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { X, Heart, Pencil, Scale } from "lucide-react";
import { useCompare } from "@/lib/compare";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { useI18n, formatMoney, categoryLabel } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Stars } from "@/components/stars";
import { useAdmin } from "@/hooks/use-admin";
import { useWishlist } from "@/lib/wishlist";
import { sanitizeImageUrl } from "@/lib/image-safety";

export type ProductImage = { url: string; color?: string | null };
export type ProductSize = { size: string; stock: number };

export type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  image_url: string | null;
  images?: ProductImage[] | null;
  sizes?: ProductSize[] | null;
  price: number;
  discount_percent: number;
  stock?: number;
  rating_avg: number;
  rating_count: number;
};

export function finalPrice(p: Product) {
  return Number(p.price) * (1 - p.discount_percent / 100);
}

export function coverImage(p: Product) {
  const list = Array.isArray(p.images) ? p.images : [];
  return sanitizeImageUrl(list[0]?.url || p.image_url || null);
}

export function sizeList(p: { sizes?: unknown }): ProductSize[] {
  return Array.isArray(p.sizes) ? (p.sizes as ProductSize[]) : [];
}

export function availableStock(p: Product) {
  const sizes = sizeList(p);
  if (sizes.length) return sizes.reduce((s, x) => s + Math.max(0, Number(x.stock) || 0), 0);
  return Number(p.stock ?? 0);
}

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const { t, lang } = useI18n();
  const { isAdmin } = useAdmin();
  const { has, toggle } = useWishlist();
  const qc = useQueryClient();
  const price = finalPrice(product);
  const hasDiscount = product.discount_percent > 0;
  const [editing, setEditing] = useState(false);
  const [priceInput, setPriceInput] = useState(String(product.price));
  const [disc, setDisc] = useState(String(product.discount_percent));
  const cover = coverImage(product);
  const stock = availableStock(product);
  const hasSizes = sizeList(product).length > 0;
  const liked = has(product.id);
  const cmp = useCompare();
  const compared = cmp.has(product.id);

  async function onDelete(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm(t("confirm_delete"))) return;
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("product_deleted"));
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["offer-products"] });
  }

  async function savePrice(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const p = Number(priceInput), d = Number(disc);
    if (!Number.isFinite(p) || p <= 0) { toast.error(t("price_invalid")); return; }
    const { error } = await supabase.from("products").update({
      price: p, discount_percent: Math.max(0, Math.min(100, d || 0)),
    }).eq("id", product.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("saved"));
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["offer-products"] });
  }

  function onCompare(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const r = cmp.toggle(product.id);
    const ar = lang === "ar";
    if (r === "full") toast.error(ar ? "أقصى حاجة 4 منتجات للمقارنة" : "Max 4 products");
    else toast.success(r === "added" ? (ar ? "اتضاف للمقارنة ⚖️" : "Added to compare ⚖️") : (ar ? "اتشال من المقارنة" : "Removed from compare"));
  }

  async function onWish(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const added = await toggle(product.id);
    toast.success(added ? t("added_to_wishlist") : t("removed_from_wishlist"));
  }

  return (
    <div className="group relative overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-lg">
      {isAdmin && (
        <div className="absolute top-2 start-2 z-10 flex gap-1">
          <button onClick={onDelete} className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow transition hover:scale-110" aria-label={t("delete_product")} title={t("delete_product")}>
            <X className="h-4 w-4" />
          </button>
          <Link to="/edit-product/$id" params={{ id: product.id }} onClick={(e) => e.stopPropagation()}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow transition hover:scale-110"
            aria-label={t("edit_product")} title={t("edit_product")}>
            <Pencil className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
      <div className="absolute bottom-[6.5rem] end-2 z-10 flex flex-col items-center gap-[6px]">
        <button onClick={onWish} aria-label={t("wishlist")} title={t("wishlist")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-background/90 shadow transition hover:scale-110">
          <Heart className={`h-4 w-4 ${liked ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
        </button>
        <button onClick={onCompare} aria-label="compare" title={lang === "ar" ? "قارن" : "Compare"}
          className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition hover:scale-105 ${compared ? "border-primary bg-primary text-primary-foreground shadow-primary/20" : "border-border bg-background/95 text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}>
          <Scale className="h-4 w-4" />
        </button>
      </div>
      <Link to="/product/$id" params={{ id: product.id }} className="block">
        <div className="relative aspect-square overflow-hidden bg-muted">
          {cover && (
            <img src={cover} alt={product.name} loading="lazy" decoding="async" width={400} height={500} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
          )}
          {hasDiscount && (
            <span className="absolute top-2 end-2 rounded-full bg-destructive px-2 py-1 text-xs font-bold text-destructive-foreground">
              -{product.discount_percent}%
            </span>
          )}
          {stock <= 0 && (
            <span className="absolute inset-x-0 bottom-0 bg-background/85 py-1 text-center text-xs font-bold text-destructive">
              {t("out_of_stock")}
            </span>
          )}
        </div>
        <div className="p-3">
          <p className="mb-1 text-xs text-muted-foreground">{categoryLabel(product.category, lang)}</p>
          <h3 className="mb-2 line-clamp-1 font-semibold">{product.name}</h3>
          <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Stars value={Number(product.rating_avg)} />
            <span>({product.rating_count})</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-bold text-primary">{formatMoney(price, lang)}</span>
            {hasDiscount && <span className="text-xs text-muted-foreground line-through">{formatMoney(Number(product.price), lang)}</span>}
          </div>
          <p className={`mt-1 text-[11px] ${stock <= 0 ? "text-destructive" : stock <= 5 ? "text-amber-600" : "text-green-600"}`}>
            {stock <= 0 ? t("out_of_stock") : stock <= 5 ? `${t("low_stock")} (${stock})` : `${t("in_stock_n")} · ${stock} ${t("units")}`}
          </p>
        </div>
      </Link>
      {isAdmin && (
        <div className="px-3 pb-2">
          {editing ? (
            <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
              <input type="number" value={priceInput} onChange={(e) => setPriceInput(e.target.value)}
                className="w-20 rounded-md border bg-background px-1 py-1 text-xs" placeholder="price" />
              <input type="number" value={disc} onChange={(e) => setDisc(e.target.value)}
                className="w-14 rounded-md border bg-background px-1 py-1 text-xs" placeholder="%" />
              <Button size="sm" variant="outline" onClick={savePrice}>{t("save")}</Button>
              <Button size="sm" variant="ghost" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditing(false); }}>×</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="w-full text-xs" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditing(true); }}>
              {t("edit_price")}
            </Button>
          )}
        </div>
      )}
      <div className="p-3 pt-0">
        {hasSizes ? (
          <Link to="/product/$id" params={{ id: product.id }} className="block">
            <Button className="w-full" size="sm" disabled={stock <= 0}>
              {stock <= 0 ? t("out_of_stock") : t("select_size")}
            </Button>
          </Link>
        ) : (
          <Button className="w-full" size="sm" disabled={stock <= 0}
            onClick={() => { add({ id: product.id, name: product.name, price, image_url: cover, max: stock }); toast.success(t("added_to_cart")); }}>
            {stock <= 0 ? t("out_of_stock") : t("add_to_cart")}
          </Button>
        )}
      </div>
    </div>
  );
}
