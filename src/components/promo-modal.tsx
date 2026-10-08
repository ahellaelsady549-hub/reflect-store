import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { X, Tag } from "lucide-react";

type Promo = { id: string; title: string; body: string; starts_at: string; ends_at: string };

const LS = "promo_dismissed";

export function PromoModal() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [promo, setPromo] = useState<Promo | null>(null);
  const [showClose, setShowClose] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("promotions")
        .select("id,title,body,starts_at,ends_at")
        .eq("active", true)
        .lte("starts_at", now)
        .gte("ends_at", now)
        .order("created_at", { ascending: false })
        .limit(1);
      const p = (data ?? [])[0] as Promo | undefined;
      if (!p || cancelled) return;
      let dismissed: string[] = [];
      try { dismissed = JSON.parse(localStorage.getItem(LS) || "[]"); } catch { /* noop */ }
      if (dismissed.includes(p.id)) return;
      setPromo(p);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!promo) return;
    setShowClose(false);
    const tm = setTimeout(() => setShowClose(true), 2000);
    return () => clearTimeout(tm);
  }, [promo]);

  if (!promo) return null;

  function dismiss() {
    try {
      const cur: string[] = JSON.parse(localStorage.getItem(LS) || "[]");
      localStorage.setItem(LS, JSON.stringify([...cur, promo!.id]));
    } catch { /* noop */ }
    setPromo(null);
  }

  const locale = lang === "ar" ? "ar-EG" : "en-GB";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-md" />
      <div className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl">
        {showClose && (
          <button
            onClick={dismiss}
            aria-label={t("close")}
            className="absolute top-3 end-3 flex h-8 w-8 items-center justify-center rounded-full bg-muted hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <div className="mb-3 flex items-center gap-2 text-primary">
          <Tag className="h-5 w-5 shrink-0" />
          <h2 className="text-lg font-bold">{promo.title}</h2>
        </div>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{promo.body}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("offer_from")} {new Date(promo.starts_at).toLocaleDateString(locale)} · {t("offer_valid_until")}{" "}
          {new Date(promo.ends_at).toLocaleDateString(locale)}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button
            className="flex-1"
            onClick={() => { dismiss(); navigate({ to: "/offers" }); }}
          >
            {t("check_offers")}
          </Button>
          <Button variant="outline" className="flex-1" onClick={dismiss}>
            {t("ignore")}
          </Button>
        </div>
      </div>
    </div>
  );
}
