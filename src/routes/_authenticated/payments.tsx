import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listPaymentsAdmin, refundPayment } from "@/lib/payments.functions";
import { useAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { formatEGP } from "@/lib/cart";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsPage,
  head: () => ({
    meta: [
      { title: "المدفوعات | Payments – Reflect" },
      { name: "description", content: "لوحة المدفوعات: متابعة عمليات الدفع وحالتها وأرقام العمليات." },
      { property: "og:title", content: "المدفوعات | Payments" },
      { property: "og:description", content: "لوحة المدفوعات: متابعة عمليات الدفع وحالتها وأرقام العمليات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = Awaited<ReturnType<typeof listPaymentsAdmin>>[number];

const FILTERS = ["all", "pending", "processing", "paid", "failed", "refunded"] as const;

function PaymentsPage() {
  const { isAdmin } = useAdmin();
  const load = useServerFn(listPaymentsAdmin);
  const doRefund = useServerFn(refundPayment);
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [busy, setBusy] = useState(false);

  const fetchRows = useCallback(async () => {
    setBusy(true);
    try {
      setRows(await load({ data: { status: filter } }));
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }, [load, filter]);

  useEffect(() => {
    if (isAdmin) void fetchRows();
  }, [isAdmin, fetchRows]);

  if (!isAdmin) return <div dir="rtl" className="p-8 text-center">غير مصرح</div>;

  async function refund(id: string) {
    if (!confirm("تأكيد استرداد المبلغ؟")) return;
    try {
      await doRefund({ data: { paymentId: id } });
      toast.success("تم الاسترداد");
      void fetchRows();
    } catch (e: any) {
      toast.error(e.message ?? "فشل الاسترداد");
    }
  }

  return (
    <div dir="rtl" className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold">المدفوعات / Payments</h1>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "secondary"} onClick={() => setFilter(f)}>
            {f}
          </Button>
        ))}
      </div>
      {busy && <p className="text-sm text-muted-foreground">...</p>}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs">
            <tr>
              {["Order", "Customer", "Amount", "Method", "Txn ID", "Status", "Created", "Paid at", "Failure", ""].map((h) => (
                <th key={h} className="whitespace-nowrap p-2 text-start font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 font-mono text-xs">{r.order_id.slice(0, 8)}</td>
                <td className="p-2">{r.customer}</td>
                <td className="whitespace-nowrap p-2">{formatEGP(r.amount)}</td>
                <td className="p-2">{r.payment_method ?? r.provider}</td>
                <td className="p-2 font-mono text-xs">{r.transaction_id ?? "—"}</td>
                <td className="p-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${
                    r.status === "paid" ? "bg-green-500/15 text-green-700 dark:text-green-400"
                      : r.status === "failed" ? "bg-destructive/15 text-destructive"
                      : r.status === "refunded" ? "bg-muted text-muted-foreground"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}`}>
                    {r.status}
                  </span>
                </td>
                <td className="whitespace-nowrap p-2 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                <td className="whitespace-nowrap p-2 text-xs">{r.paid_at ? new Date(r.paid_at).toLocaleString() : "—"}</td>
                <td className="max-w-40 truncate p-2 text-xs text-muted-foreground">{r.failure_reason ?? "—"}</td>
                <td className="p-2">
                  {r.status === "paid" && (
                    <Button size="sm" variant="outline" onClick={() => refund(r.id)}>استرداد</Button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !busy && (
              <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">لا توجد مدفوعات</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
