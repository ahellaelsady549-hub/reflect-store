import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/use-admin";
import { useI18n, formatMoney } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trash2, Ticket } from "lucide-react";

export const Route = createFileRoute("/_authenticated/promo-codes")({
  component: PromoCodesPage,
  head: () => ({
    meta: [
      { title: "أكواد الخصم | Reflect" },
      { name: "description", content: "إدارة أكواد الخصم الخاصة بمتجر Reflect." },
      { property: "og:title", content: "أكواد الخصم | Reflect" },
      { property: "og:description", content: "إدارة أكواد الخصم الخاصة بمتجر Reflect." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Promo = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order: number;
  max_uses: number | null;
  used_count: number;
  starts_at: string;
  ends_at: string | null;
  active: boolean;
};

function PromoCodesPage() {
  const { isAdmin } = useAdmin();
  const { t, lang } = useI18n();
  const qc = useQueryClient();

  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("10");
  const [minOrder, setMinOrder] = useState("0");
  const [maxUses, setMaxUses] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ["promo-codes"],
    queryFn: async (): Promise<Promo[]> => {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Promo[];
    },
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">403</div>;
  }

  async function addCode(e: React.FormEvent) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("promo_codes").insert({
      code: clean,
      discount_type: type,
      discount_value: Number(value) || 0,
      min_order: Number(minOrder) || 0,
      max_uses: maxUses ? Number(maxUses) : null,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      created_by: u.user?.id ?? null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("promo_added"));
    setCode(""); setMaxUses(""); setEndsAt("");
    qc.invalidateQueries({ queryKey: ["promo-codes"] });
  }

  async function toggleActive(p: Promo) {
    const { error } = await supabase.from("promo_codes").update({ active: !p.active }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["promo-codes"] });
  }

  async function remove(p: Promo) {
    if (!confirm(t("confirm_delete"))) return;
    const { error } = await supabase.from("promo_codes").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("promo_deleted"));
    qc.invalidateQueries({ queryKey: ["promo-codes"] });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <Ticket className="h-6 w-6 text-primary" /> {t("promo_codes")}
      </h1>

      <form onSubmit={addCode} className="mb-8 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label htmlFor="pc">{t("promo_code")}</Label>
          <Input id="pc" value={code} onChange={(e) => setCode(e.target.value)} placeholder="REFLECT20" required />
        </div>
        <div>
          <Label htmlFor="pt">{t("promo_type")}</Label>
          <select
            id="pt"
            value={type}
            onChange={(e) => setType(e.target.value as "percent" | "fixed")}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="percent">{t("promo_percent")}</option>
            <option value="fixed">{t("promo_fixed")}</option>
          </select>
        </div>
        <div>
          <Label htmlFor="pv">{t("promo_value")}</Label>
          <Input id="pv" type="number" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="pm">{t("promo_min_order")}</Label>
          <Input id="pm" type="number" min="0" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="pu">{t("promo_max_uses")}</Label>
          <Input id="pu" type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="∞" />
        </div>
        <div>
          <Label htmlFor="pe">{t("ends_at")}</Label>
          <Input id="pe" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <Button type="submit" disabled={saving}>{saving ? t("loading") : t("save")}</Button>
        </div>
      </form>

      {isLoading ? (
        <p className="text-muted-foreground">{t("loading")}</p>
      ) : codes.length === 0 ? (
        <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">{t("no_promo_codes")}</p>
      ) : (
        <div className="space-y-3">
          {codes.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
              <span className="rounded bg-primary/10 px-2 py-1 font-mono font-bold text-primary">{p.code}</span>
              <span className="text-sm">
                {p.discount_type === "percent"
                  ? `${Number(p.discount_value)}%`
                  : formatMoney(Number(p.discount_value), lang)}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("promo_min_order")}: {formatMoney(Number(p.min_order), lang)}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("promo_used")}: {p.used_count}{p.max_uses ? ` / ${p.max_uses}` : ""}
              </span>
              {p.ends_at && (
                <span className="text-xs text-muted-foreground">
                  {t("ends_at")}: {new Date(p.ends_at).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB")}
                </span>
              )}
              <div className="ms-auto flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={p.active} onChange={() => toggleActive(p)} />
                  {t("active")}
                </label>
                <Button variant="ghost" size="icon" onClick={() => remove(p)} aria-label={t("remove")}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
