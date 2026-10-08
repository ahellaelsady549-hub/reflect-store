import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Stars, StarsInput } from "@/components/stars";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Review = { id: string; user_id: string; stars: number; comment: string | null; created_at: string };

export function ProductReviews({ productId }: { productId: string }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const qc = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null)); }, []);

  const { data: canReview = false } = useQuery({
    queryKey: ["can-review", productId, uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase.from("order_items")
        .select("id, orders!inner(status,user_id)")
        .eq("product_id", productId).eq("orders.status", "delivered").eq("orders.user_id", uid!).limit(1);
      return (data ?? []).length > 0;
    },
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", productId],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_ratings")
        .select("id,user_id,stars,comment,created_at").eq("product_id", productId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Review[];
    },
  });

  const { data: names = {} } = useQuery({
    queryKey: ["review-names", reviews.map((r) => r.user_id).join(",")],
    enabled: reviews.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name").in("id", reviews.map((r) => r.user_id));
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name || "—"])) as Record<string, string>;
    },
  });

  const mine = reviews.find((r) => r.user_id === uid);
  useEffect(() => { if (mine) { setStars(mine.stars); setComment(mine.comment ?? ""); } }, [mine?.id]);

  async function save() {
    if (!uid || stars < 1) return;
    setBusy(true);
    const { error } = await supabase.from("product_ratings").upsert(
      { product_id: productId, user_id: uid, stars, comment: comment.trim().slice(0, 1000) || null },
      { onConflict: "product_id,user_id" },
    );
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(ar ? "تقييمك اتحفظ 🙌" : "Review saved 🙌");
    qc.invalidateQueries({ queryKey: ["reviews", productId] });
    qc.invalidateQueries({ queryKey: ["product", productId] });
  }

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.stars, 0) / reviews.length : 0;

  return (
    <section className="mt-10 border-t pt-6 space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">{ar ? "تقييمات ومراجعات" : "Ratings & reviews"}</h2>
        {reviews.length > 0 && <span className="text-sm text-muted-foreground">⭐ {avg.toFixed(1)} / 5 · {reviews.length}</span>}
      </div>

      {uid && canReview && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold">{mine ? (ar ? "عدّل تقييمك" : "Edit your review") : (ar ? "قيّمي مشترياتك ✨" : "Rate your purchase ✨")}</p>
          <StarsInput value={stars} onChange={setStars} />
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={3}
            placeholder={ar ? "اكتبي رأيك في المنتج..." : "Write your thoughts..."}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          <Button size="sm" onClick={save} disabled={busy || stars < 1}>{ar ? "حفظ" : "Save"}</Button>
        </div>
      )}
      {uid && !canReview && (
        <p className="text-sm text-muted-foreground">{ar ? "تقدري تقيّمي المنتج بعد ما طلبك يوصلك 📦" : "You can review after your order is delivered 📦"}</p>
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">{ar ? "لسه مفيش تقييمات." : "No reviews yet."}</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{names[r.user_id] ?? "—"}</span>
                <Stars value={r.stars} size={14} />
              </div>
              {r.comment && <p className="mt-2 text-sm whitespace-pre-wrap">{r.comment}</p>}
              <p className="mt-1 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString(ar ? "ar-EG" : "en-GB")}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
