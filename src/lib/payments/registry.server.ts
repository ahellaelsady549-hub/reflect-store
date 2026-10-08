// Server-only payment orchestration shared by server functions and the webhook route.
import type { PaymentProvider, VerifyResult } from "./types";
import { fawryProvider } from "./fawry.server";

const providers: Record<string, PaymentProvider> = {
  fawry: fawryProvider,
};

export function getProvider(name: string): PaymentProvider {
  const p = providers[name];
  if (!p) throw new Error(`Unknown payment provider: ${name}`);
  return p;
}

export function listProviders() {
  return Object.values(providers).map((p) => ({ name: p.name, configured: p.isConfigured() }));
}

type ApplyOptions = {
  provider: string;
  /** Distinct key used to make callbacks idempotent. */
  eventKey?: string;
};

/**
 * Single source of truth for moving a payment/order to a terminal state.
 * Verifies amount + currency + reference against our own database record.
 */
export async function applyVerification(v: VerifyResult, opts: ApplyOptions) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (!v.merchantReference) return { ok: false, reason: "missing_reference" as const };

  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("merchant_reference", v.merchantReference)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!payment) return { ok: false, reason: "unknown_payment" as const };

  // Idempotency: ignore replays of an event we already processed.
  if (opts.eventKey) {
    const { error: dupErr } = await supabaseAdmin.from("payment_events").insert({
      payment_id: payment.id,
      provider: opts.provider,
      event_key: opts.eventKey,
      payload: (v.raw ?? null) as any,
    });
    if (dupErr) {
      if (dupErr.code === "23505") return { ok: true, duplicate: true as const, status: payment.status };
      throw new Error(dupErr.message);
    }
  }

  if (payment.status === "paid" || payment.status === "refunded") {
    return { ok: true, status: payment.status };
  }

  let status = v.status;
  let failureReason = v.failureReason;

  if (status === "paid") {
    // Server-side amount + currency validation against OUR order total.
    const expected = Number(payment.amount);
    const got = v.amount == null ? NaN : Number(v.amount);
    const currencyOk = (v.currency ?? "EGP").toUpperCase() === String(payment.currency).toUpperCase();
    if (!Number.isFinite(got) || Math.abs(got - expected) > 0.01 || !currencyOk) {
      status = "failed";
      failureReason = `Amount/currency mismatch (expected ${expected} ${payment.currency}, got ${v.amount} ${v.currency})`;
    }
  }

  const { error: upErr } = await supabaseAdmin
    .from("payments")
    .update({
      status,
      transaction_id: v.transactionId ?? payment.transaction_id,
      payment_method: v.paymentMethod ?? payment.payment_method,
      failure_reason: failureReason ?? null,
      raw_response: (v.raw ?? null) as any,
      paid_at: status === "paid" ? new Date().toISOString() : payment.paid_at,
    })
    .eq("id", payment.id);
  if (upErr) throw new Error(upErr.message);

  // Order status only follows a verified payment status.
  const orderStatus =
    status === "paid" ? "paid" : status === "refunded" ? "refunded" : status === "failed" ? "failed" : null;
  if (orderStatus) {
    await supabaseAdmin.from("orders").update({ status: orderStatus }).eq("id", payment.order_id);
  }

  await supabaseAdmin.from("admin_audit_log").insert({
    actor_id: null,
    actor_email: null,
    action: "payment_" + status,
    entity_type: "payment",
    entity_id: payment.id,
    details: {
      provider: opts.provider,
      order_id: payment.order_id,
      merchant_reference: v.merchantReference,
      transaction_id: v.transactionId,
      amount: v.amount,
      currency: v.currency,
    } as any,
  });

  return { ok: true, status };
}
