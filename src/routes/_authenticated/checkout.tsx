import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useCart, formatEGP } from "@/lib/cart";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CreditCard, Wallet, Truck, Smartphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/checkout")({
  component: CheckoutPage,
});

type Method = "card" | "instapay" | "vodafone" | "cod";

function CheckoutPage() {
  const { items, total, clear } = useCart();
  const navigate = useNavigate();
  const [method, setMethod] = useState<Method>("card");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [processing, setProcessing] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; discount: number } | null>(null);
  const [checkingPromo, setCheckingPromo] = useState(false);
  const discount = promo ? Math.min(promo.discount, total) : 0;
  const grandTotal = Math.max(0, total - discount);

  if (items.length === 0) {
    return (
      <div dir="rtl" className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="mb-4">سلتك فارغة</p>
        <Link to="/"><Button>تصفح المنتجات</Button></Link>
      </div>
    );
  }

  async function applyPromo() {
    const code = promoInput.trim();
    if (!code) return;
    setCheckingPromo(true);
    try {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("code,discount_type,discount_value,min_order,max_uses,used_count,starts_at,ends_at,active")
        .ilike("code", code)
        .maybeSingle();
      if (error) throw error;
      const now = Date.now();
      const valid =
        data &&
        data.active &&
        new Date(data.starts_at).getTime() <= now &&
        (!data.ends_at || new Date(data.ends_at).getTime() >= now) &&
        (data.max_uses == null || data.used_count < data.max_uses) &&
        total >= Number(data.min_order);
      if (!valid) {
        setPromo(null);
        toast.error("كود غير صحيح أو منتهي / Invalid or expired code");
        return;
      }
      const value =
        data.discount_type === "percent"
          ? (total * Number(data.discount_value)) / 100
          : Number(data.discount_value);
      setPromo({ code: data.code, discount: Math.round(value) });
      toast.success("تم تطبيق كود الخصم");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setCheckingPromo(false);
    }
  }


  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setProcessing(true);
    try {
      const { data: orderId, error } = await supabase.rpc("create_order", {
        _items: items.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
          size: item.size ?? null,
        })),
        _payment_method: method,
        _shipping_address: address,
        _phone: phone,
        _promo_code: promo?.code ?? null,
      });
      if (error) throw error;
      if (!orderId) throw new Error("تعذر إنشاء الطلب");

      clear();
      toast.success(method === "cod" ? "تم استلام طلبك" : "تم تسجيل الطلب وهو بانتظار تأكيد الدفع");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الطلب");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div dir="rtl" className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">إتمام الشراء</h1>
      <form onSubmit={pay} className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="border rounded-lg p-4 bg-card">
            <h2 className="font-bold mb-4">بيانات الاستلام</h2>
            <div className="space-y-3">
              <div>
                <Label htmlFor="phone">رقم الهاتف</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="01xxxxxxxxx" />
              </div>
              <div>
                <Label htmlFor="address">عنوان الاستلام</Label>
                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="المحافظة، المدينة، الشارع، رقم المبنى" />
              </div>
            </div>
          </section>

          <section className="border rounded-lg p-4 bg-card">
            <h2 className="font-bold mb-4">طريقة الدفع</h2>
            <div className="grid grid-cols-2 gap-2 mb-4 sm:grid-cols-2">
              <MethodBtn active={method === "card"} onClick={() => setMethod("card")} icon={<CreditCard className="h-5 w-5" />} label="Kashier (كارت)" />
              <MethodBtn active={method === "instapay"} onClick={() => setMethod("instapay")} icon={<Smartphone className="h-5 w-5" />} label="إنستاباي" />
              <MethodBtn active={method === "vodafone"} onClick={() => setMethod("vodafone")} icon={<Wallet className="h-5 w-5" />} label="فودافون كاش" />
              <MethodBtn active={method === "cod"} onClick={() => setMethod("cod")} icon={<Truck className="h-5 w-5" />} label="عند الاستلام" />
            </div>

            {method === "card" && (
              <p className="text-sm text-muted-foreground">
                الدفع بالبطاقة غير متاح حاليًا. لن نطلب أو نخزن بيانات بطاقتك، وسيظل الطلب بانتظار تأكيد الدفع.
              </p>
            )}
            {method === "instapay" && (
              <p className="text-sm text-muted-foreground">
                لن يُطلب منك إدخال بيانات مالية هنا. سيظل الطلب بانتظار التحقق من التحويل.
              </p>
            )}
            {method === "vodafone" && (
              <p className="text-sm text-muted-foreground">
                لن يُطلب منك إدخال بيانات المحفظة هنا. سيظل الطلب بانتظار التحقق من التحويل.
              </p>
            )}
            {method === "cod" && (
              <p className="text-sm text-muted-foreground">ستدفع قيمة الطلب نقدا عند استلام الشحنة.</p>
            )}
          </section>
        </div>

        <div className="border rounded-lg p-4 bg-card h-fit">
          <h2 className="font-bold mb-4">ملخص الطلب</h2>
          <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
            {items.map((i) => (
              <div key={i.id} className="flex justify-between text-sm">
                <span className="truncate">{i.name} × {i.quantity}</span>
                <span className="whitespace-nowrap">{formatEGP(i.price * i.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="mb-3 space-y-2 border-t pt-3">
            <Label htmlFor="promo">كود الخصم</Label>
            <div className="flex gap-2">
              <Input
                id="promo"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder="REFLECT20"
              />
              <Button type="button" variant="secondary" onClick={applyPromo} disabled={checkingPromo}>
                تطبيق
              </Button>
            </div>
            {promo && (
              <p className="text-xs text-green-600 dark:text-green-400">
                ✓ {promo.code} — خصم {formatEGP(discount)}
                <button type="button" onClick={() => { setPromo(null); setPromoInput(""); }} className="ms-2 underline">
                  إزالة
                </button>
              </p>
            )}
          </div>
          <div className="flex justify-between text-sm">
            <span>المجموع</span><span>{formatEGP(total)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
              <span>الخصم</span><span>-{formatEGP(discount)}</span>
            </div>
          )}
          <div className="border-t mt-2 pt-3 flex justify-between font-bold text-lg">
            <span>الإجمالي</span><span className="text-primary">{formatEGP(grandTotal)}</span>
          </div>
          <Button type="submit" className="w-full mt-4" size="lg" disabled={processing}>
            {processing ? "جاري المعالجة..." : method === "cod" ? "تأكيد الطلب" : "إنشاء الطلب"}
          </Button>

        </div>
      </form>
    </div>
  );
}

function MethodBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-sm transition-colors ${active ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}>
      {icon}<span>{label}</span>
    </button>
  );
}
