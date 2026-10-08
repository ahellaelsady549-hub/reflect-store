import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, formatMoney } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Package, ShoppingBag, XCircle } from "lucide-react";
import { toast } from "sonner";
import { OrderStatusTracker } from "@/components/order-status-tracker";
import { normalizeGoogleMapsUrl } from "@/lib/google-maps";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type OrderRow = {
  id: string;
  total: number;
  status: string;
  payment_method: string;
  shipping_address: string;
  backup_phone: string | null;
  google_maps_url: string | null;
  created_at: string;
  order_items: { product_name: string; unit_price: number; quantity: number }[];
};

const CANCELLABLE = ["pending", "paid"];

function Dashboard() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,total,status,payment_method,shipping_address,backup_phone,google_maps_url,created_at,order_items(product_name,unit_price,quantity)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as OrderRow[];
    },
  });

  async function cancelOrder(id: string) {
    if (!confirm(t("confirm_cancel_order"))) return;
    const { error } = await supabase.from("orders").update({ status: "cancelled" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("order_cancelled"));
    qc.invalidateQueries({ queryKey: ["my-orders"] });
  }


  const totalSpent = orders.reduce((s, o) => s + Number(o.total), 0);
  const locale = lang === "ar" ? "ar-EG" : "en-GB";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{t("dashboard")}</h1>

      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <div className="border rounded-lg p-5 bg-card flex items-center gap-4">
          <div className="rounded-full bg-primary/10 p-3"><Package className="h-6 w-6 text-primary" /></div>
          <div>
            <p className="text-sm text-muted-foreground">{t("total_orders")}</p>
            <p className="text-2xl font-bold">{orders.length}</p>
          </div>
        </div>
        <div className="border rounded-lg p-5 bg-card flex items-center gap-4">
          <div className="rounded-full bg-primary/10 p-3"><ShoppingBag className="h-6 w-6 text-primary" /></div>
          <div>
            <p className="text-sm text-muted-foreground">{t("total_spent")}</p>
            <p className="text-2xl font-bold">{formatMoney(totalSpent, lang)}</p>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4">{t("my_orders")}</h2>
      {isLoading ? (
        <p className="text-muted-foreground">{t("loading")}</p>
      ) : orders.length === 0 ? (
        <div className="border rounded-lg p-10 text-center bg-card">
          <p className="text-muted-foreground mb-4">{t("no_orders")}</p>
          <Link to="/"><Button>{t("browse")}</Button></Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.id} className="border rounded-lg p-4 bg-card">
              <div className="flex flex-wrap justify-between gap-2 mb-3 pb-3 border-b">
                <div>
                  <p className="text-xs text-muted-foreground">{t("order_no")}</p>
                  <p className="font-mono text-sm">#{o.id.slice(0, 8)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("date")}</p>
                  <p className="text-sm">{new Date(o.created_at).toLocaleDateString(locale)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("payment")}</p>
                  <p className="text-sm">{o.payment_method}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("total")}</p>
                  <p className="font-bold text-primary">{formatMoney(Number(o.total), lang)}</p>
                </div>
              </div>
              <div className="my-4">
                <OrderStatusTracker status={o.status} />
              </div>
              <div className="space-y-1 border-t pt-3">
                {o.order_items.map((i, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{i.product_name} × {i.quantity}</span>
                    <span className="text-muted-foreground">{formatMoney(i.unit_price * i.quantity, lang)}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">📍 {o.shipping_address}</p>
              {o.backup_phone && <p className="text-xs text-muted-foreground mt-1">☎ رقم احتياطي: {o.backup_phone}</p>}
              {o.google_maps_url && normalizeGoogleMapsUrl(o.google_maps_url) && (
                <a href={normalizeGoogleMapsUrl(o.google_maps_url) ?? undefined} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-primary underline underline-offset-2">
                  فتح موقع الاستلام على Google Maps
                </a>
              )}
              {CANCELLABLE.includes(o.status) && (
                <Button variant="outline" size="sm" className="mt-3 text-destructive" onClick={() => cancelOrder(o.id)}>
                  <XCircle className="h-4 w-4 me-1" /> {t("cancel_order")}
                </Button>
              )}

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
