import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCart, formatEGP, itemKey } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Trash2, Minus, Plus, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/cart")({
  component: CartPage,
});

function CartPage() {
  const { items, setQty, remove, total } = useCart();
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
  }, []);

  if (items.length === 0) {
    return (
      <div dir="rtl" className="mx-auto max-w-3xl px-4 py-16 text-center">
        <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">سلة التسوق فارغة</h1>
        <p className="text-muted-foreground mb-6">ابدأ التسوق وأضف منتجات لسلتك</p>
        <Link to="/"><Button>تصفح المنتجات</Button></Link>
      </div>
    );
  }

  return (
    <div dir="rtl" className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">سلة التسوق</h1>
      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {items.map((item) => (
            <div key={itemKey(item)} className="flex gap-3 border rounded-lg p-3 bg-card">
              <div className="w-20 h-20 rounded overflow-hidden bg-muted shrink-0">
                {item.image_url && <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium line-clamp-1">{item.name}</h3>
                <p className="text-sm text-primary font-semibold">{formatEGP(item.price)}</p>
                {item.size && <p className="text-xs text-muted-foreground">المقاس: {item.size}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center border rounded">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQty(itemKey(item), item.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-8 text-center text-sm">{item.quantity}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQty(itemKey(item), item.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(itemKey(item))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="font-bold whitespace-nowrap">{formatEGP(item.price * item.quantity)}</div>
            </div>
          ))}
        </div>
        <div className="border rounded-lg p-4 bg-card h-fit">
          <h2 className="font-bold mb-4">ملخص الطلب</h2>
          <div className="flex justify-between mb-2 text-sm"><span>المجموع الفرعي</span><span>{formatEGP(total)}</span></div>
          <div className="flex justify-between mb-2 text-sm"><span>الشحن</span><span className="text-green-600">مجاني</span></div>
          <div className="border-t pt-3 mt-3 flex justify-between font-bold text-lg"><span>الإجمالي</span><span className="text-primary">{formatEGP(total)}</span></div>
          <Button className="w-full mt-4" size="lg" onClick={() => navigate({ to: authed ? "/checkout" : "/auth", search: authed ? undefined : { redirect: "/checkout" } as any })}>
            {authed ? "إتمام الشراء" : "سجل الدخول لإتمام الشراء"}
          </Button>
        </div>
      </div>
    </div>
  );
}
