import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/use-admin";
import { useI18n, CATEGORY_KEYS, categoryLabel } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ImageOff, Plus, X } from "lucide-react";
import { sanitizeImageUrl } from "@/lib/image-safety";
import { SizesEditor } from "@/routes/_authenticated/edit-product.$id";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

type Img = { url: string; color: string };
type Sz = { size: string; stock: number };

export const Route = createFileRoute("/_authenticated/add-product")({
  head: () => ({
    meta: [
      { title: "إضافة منتج | Reflect Admin" },
      { name: "description", content: "لوحة الأدمن لإضافة منتج جديد بصور متعددة وألوان وسعر وخصم بالجنيه المصري." },
      { property: "og:title", content: "إضافة منتج | Reflect" },
      { property: "og:description", content: "إضافة منتج جديد بصور متعددة وألوان وسعر وخصم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AddProductPage,
});

function AddProductPage() {
  const { t, lang } = useI18n();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("رجالي");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("0");
  const [stock, setStock] = useState("10");
  const [images, setImages] = useState<Img[]>([]);
  const [sizes, setSizes] = useState<Sz[]>([]);
  const [draftSize, setDraftSize] = useState("");
  const [draftSizeStock, setDraftSizeStock] = useState("1");
  const [draftUrl, setDraftUrl] = useState("");
  const [draftColor, setDraftColor] = useState("#000000");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setReady(true); }, []);

  if (ready && !isAdmin) return <div className="p-10 text-center text-destructive">Forbidden</div>;

  function addSize() {
    const sz = draftSize.trim();
    if (!sz) return;
    setSizes((prev) => prev.some((x) => x.size === sz) ? prev : [...prev, { size: sz, stock: Math.max(0, Number(draftSizeStock) || 0) }]);
    setDraftSize("");
    setDraftSizeStock("1");
  }

  function pushImage(url: string) {
    const safeUrl = sanitizeImageUrl(url);
    if (!safeUrl) {
      toast.error(t("image_url_invalid") || "Invalid image URL");
      return;
    }
    setImages((prev) => [...prev, { url: safeUrl, color: draftColor }]);
    setDraftUrl("");
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    for (const f of files) {
      if (!ALLOWED.includes(f.type)) { toast.error(t("image_type_invalid")); continue; }
      if (f.size > MAX_IMAGE_BYTES) { toast.error(t("image_too_large")); continue; }
      const reader = new FileReader();
      reader.onload = () => {
        const safeUrl = sanitizeImageUrl(String(reader.result));
        if (!safeUrl) {
          toast.error(t("image_type_invalid"));
          return;
        }
        setImages((prev) => [...prev, { url: safeUrl, color: draftColor }]);
      };
      reader.readAsDataURL(f);
    }
    e.target.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < 2) { toast.error(t("name_required")); return; }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) { toast.error(t("price_invalid")); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("products").insert({
        name: trimmedName,
        description: description.trim().replace(/\n{3,}/g, "\n\n") || null,
        category,
        price: priceNum,
        discount_percent: Math.max(0, Math.min(100, Number(discount) || 0)),
        stock: sizes.length ? sizes.reduce((a, x) => a + Math.max(0, x.stock), 0) : Math.max(0, Number(stock) || 0),
        sizes: sizes as any,
        image_url: images[0]?.url ?? null,
        images: images as any,
      });
      if (error) throw error;
      toast.success(t("product_added"));
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t("add_product")}</h1>
      <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
        <div>
          <Label>{t("name")}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        </div>
        <div>
          <Label>{t("description")}</Label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={600}
            className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm"
            placeholder={t("description_hint")}
          />
          <p className="mt-1 text-xs text-muted-foreground">{description.trim().length}/600</p>
        </div>
        <div>
          <Label>{t("category")}</Label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-md border bg-background px-2 py-2 text-sm">
            {CATEGORY_KEYS.filter((c) => c !== "الكل").map((c) => (
              <option key={c} value={c}>{categoryLabel(c, lang)}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label>{t("price")} (EGP)</Label>
            <Input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
          <div>
            <Label>{t("discount")} %</Label>
            <Input type="number" min={0} max={100} value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>
          <div>
            <Label>{t("stock")}</Label>
            <Input type="number" min={0} disabled={sizes.length > 0}
              value={sizes.length ? String(sizes.reduce((a, x) => a + x.stock, 0)) : stock}
              onChange={(e) => setStock(e.target.value)} />
          </div>
        </div>

        <SizesEditor t={t} sizes={sizes} setSizes={setSizes} draftSize={draftSize} setDraftSize={setDraftSize}
          draftSizeStock={draftSizeStock} setDraftSizeStock={setDraftSizeStock} addSize={addSize} />

        <div className="space-y-3">
          <Label>{t("images")} · {t("colors")}</Label>
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
            <input
              type="color" value={draftColor} onChange={(e) => setDraftColor(e.target.value)}
              aria-label={t("color")} className="h-9 w-10 shrink-0 cursor-pointer rounded-md border bg-background"
            />
            <Input value={draftUrl} onChange={(e) => setDraftUrl(e.target.value)} placeholder={t("image_url_label")} />
            <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => pushImage(draftUrl.trim())}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <input type="file" multiple accept={ALLOWED.join(",")} onChange={onFile}
            className="text-xs file:me-2 file:rounded-md file:border file:bg-muted file:px-2 file:py-1 file:text-xs" />
          <p className="text-xs text-muted-foreground">{t("image_help")}</p>

          {images.length === 0 ? (
            <div className="flex aspect-video w-full items-center justify-center rounded-md border bg-muted">
              <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                <ImageOff className="h-6 w-6" />
                <span>{t("no_image_preview")}</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((im, i) => (
                <div key={i} className="relative overflow-hidden rounded-md border bg-muted">
                  <img src={im.url} alt="" className="aspect-square w-full object-cover" />
                  <span className="absolute bottom-1 start-1 h-4 w-4 rounded-full border border-white shadow" style={{ background: im.color }} />
                  <button type="button" onClick={() => setImages((p) => p.filter((_, k) => k !== i))}
                    className="absolute top-1 end-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/" })}>{t("cancel")}</Button>
          <Button type="submit" disabled={busy}>{busy ? "..." : t("save")}</Button>
        </div>
      </form>
    </div>
  );
}
