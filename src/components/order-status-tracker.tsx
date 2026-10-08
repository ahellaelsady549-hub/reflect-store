import { Check, Clock, Package, Truck, Home, XCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const STEPS = ["pending", "paid", "processing", "shipped", "delivered"] as const;
type Step = (typeof STEPS)[number];

const ICONS: Record<Step, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  paid: Check,
  processing: Package,
  shipped: Truck,
  delivered: Home,
};

export function OrderStatusTracker({ status }: { status: string }) {
  const { t } = useI18n();

  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 text-destructive text-sm">
        <XCircle className="h-4 w-4" /> {t("status_cancelled")}
      </div>
    );
  }

  // For COD, treat "pending" as the entry. For card/wallet, "paid" is the entry.
  const currentIndex = Math.max(0, STEPS.indexOf(status as Step));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {STEPS.map((s, i) => {
          const Icon = ICONS[s];
          const done = i <= currentIndex;
          const isCurrent = i === currentIndex;
          return (
            <div key={s} className="flex-1 flex flex-col items-center relative">
              <div
                className={`z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
                  done ? "bg-primary border-primary text-primary-foreground" : "bg-background border-border text-muted-foreground"
                } ${isCurrent ? "ring-2 ring-primary/30" : ""}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span className={`mt-1 text-[10px] sm:text-xs text-center ${done ? "font-medium" : "text-muted-foreground"}`}>
                {t(`status_${s}` as any)}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={`absolute top-4 left-1/2 h-0.5 w-full ${
                    i < currentIndex ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
