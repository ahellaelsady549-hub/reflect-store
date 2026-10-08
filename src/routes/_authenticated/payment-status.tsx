import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getOrderPaymentStatus } from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/payment-status")({
  validateSearch: (s: Record<string, unknown>) => ({ orderId: String(s['orderId'] ?? "") }),
  component: PaymentStatusPage,
  head: () => ({
    meta: [
      { title: "حالة الدفع | Payment status – Reflect" },
      { name: "description", content: "تحقق من حالة الدفع الخاصة بطلبك في Reflect." },
      { property: "og:title", content: "حالة الدفع | Payment status" },
      { property: "og:description", content: "تحقق من حالة الدفع الخاصة بطلبك في Reflect." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PaymentStatusPage() {
  const { orderId } = Route.useSearch();
  const navigate = useNavigate();
  const { lang } = useI18n();
  const check = useServerFn(getOrderPaymentStatus);
  const [status, setStatus] = useState<string>("pending");
  const [info, setInfo] = useState<{ transactionId: string | null; failureReason: string | null } | null>(null);
  const [tries, setTries] = useState(0);
  const ar = lang === "ar";

  const poll = useCallback(async () => {
    try {
      const res = await check({ data: { orderId } });
      setStatus(res.status);
      setInfo({ transactionId: res.transactionId, failureReason: res.failureReason });
    } catch {
      setStatus("failed");
    }
  }, [check, orderId]);

  useEffect(() => {
    if (!orderId) return;
    void poll();
  }, [orderId, poll]);

  useEffect(() => {
    if (status === "paid" || status === "failed" || status === "cancelled" || status === "refunded") return;
    if (tries > 20) return;
    const t = setTimeout(() => {
      setTries((n) => n + 1);
      void poll();
    }, 4000);
    return () => clearTimeout(t);
  }, [status, tries, poll]);

  if (!orderId) {
    return <div dir={ar ? "rtl" : "ltr"} className="mx-auto max-w-lg px-4 py-16 text-center">{ar ? "طلب غير معروف" : "Unknown order"}</div>;
  }

  return (
    <div dir={ar ? "rtl" : "ltr"} className="mx-auto max-w-lg px-4 py-16 text-center">
      {status === "paid" ? (
        <>
          <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-green-600" />
          <h1 className="mb-2 text-2xl font-bold">{ar ? "تم الدفع بنجاح" : "Payment successful"}</h1>
          {info?.transactionId && (
            <p className="text-sm text-muted-foreground">
              {ar ? "رقم العملية" : "Transaction"}: {info.transactionId}
            </p>
          )}
          <Button className="mt-6" onClick={() => navigate({ to: "/dashboard" })}>
            {ar ? "طلباتي" : "My orders"}
          </Button>
        </>
      ) : status === "failed" || status === "cancelled" ? (
        <>
          <XCircle className="mx-auto mb-4 h-14 w-14 text-destructive" />
          <h1 className="mb-2 text-2xl font-bold">{ar ? "فشلت عملية الدفع" : "Payment failed"}</h1>
          <p className="text-sm text-muted-foreground">{info?.failureReason ?? (ar ? "لم يكتمل الدفع" : "Payment was not completed")}</p>
          <div className="mt-6 flex justify-center gap-2">
            <Link to="/checkout"><Button>{ar ? "حاول مرة أخرى" : "Try again"}</Button></Link>
            <Link to="/dashboard"><Button variant="secondary">{ar ? "طلباتي" : "My orders"}</Button></Link>
          </div>
        </>
      ) : status === "refunded" ? (
        <>
          <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
          <h1 className="text-2xl font-bold">{ar ? "تم استرداد المبلغ" : "Payment refunded"}</h1>
        </>
      ) : (
        <>
          <Loader2 className="mx-auto mb-4 h-14 w-14 animate-spin text-primary" />
          <h1 className="mb-2 text-2xl font-bold">{ar ? "جاري التحقق من الدفع" : "Verifying your payment"}</h1>
          <p className="text-sm text-muted-foreground">
            {ar ? "لا تغلق الصفحة، نتحقق من الدفع مع البوابة." : "Please wait, we are confirming the payment with the gateway."}
          </p>
        </>
      )}
    </div>
  );
}
