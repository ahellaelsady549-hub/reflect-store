import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Which providers are usable right now (no secrets exposed). */
export const getPaymentProviders = createServerFn({ method: "GET" }).handler(async () => {
  const { listProviders } = await import("@/lib/payments/registry.server");
  return listProviders();
});

/**
 * Creates (or reuses) a payment for an existing order and returns the provider redirect URL.
 * The amount is always recomputed on the server from the database.
 */
export const startProviderPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string; provider?: string }) => {
    if (!d?.orderId || typeof d.orderId !== "string" || d.orderId.length > 64) {
      throw new Error("Invalid orderId");
    }
    const provider = d.provider ?? "fawry";
    if (!/^[a-z_]{2,32}$/.test(provider)) throw new Error("Invalid provider");
    return { orderId: d.orderId, provider };
  })
  .handler(async ({ data, context }) => {
    const { getProvider } = await import("@/lib/payments/registry.server");
    const provider = getProvider(data.provider);
    if (!provider.isConfigured()) {
      throw new Error(
        "Payment provider is not configured yet. Add the provider credentials in the backend secrets first.",
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id,user_id,status,discount_amount,phone,order_items(id,product_id,product_name,unit_price,quantity)")
      .eq("id", data.orderId)
      .maybeSingle();
    if (orderErr) throw new Error(orderErr.message);
    if (!order || order.user_id !== context.userId) throw new Error("Order not found");
    if (["paid", "refunded", "cancelled"].includes(order.status)) throw new Error("Order is not payable");

    // ---- Server-side price recomputation (never trust the client) ----
    const items = order.order_items ?? [];
    if (items.length === 0) throw new Error("Order has no items");
    const productIds = items.map((i: any) => i.product_id).filter(Boolean);
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id,price,discount_percent")
      .in("id", productIds.length ? productIds : ["00000000-0000-0000-0000-000000000000"]);
    const priceMap = new Map(
      (products ?? []).map((p: any) => [
        p.id,
        Math.round(Number(p.price) * (1 - Number(p.discount_percent ?? 0) / 100)),
      ]),
    );

    let subtotal = 0;
    const chargeItems = items.map((i: any) => {
      const unit = priceMap.get(i.product_id) ?? Number(i.unit_price);
      subtotal += unit * Number(i.quantity);
      return {
        id: String(i.product_id ?? i.id),
        description: String(i.product_name).slice(0, 50),
        price: unit,
        quantity: Number(i.quantity),
      };
    });
    const amount = Math.max(0, subtotal - Number(order.discount_amount ?? 0));
    if (amount <= 0) throw new Error("Invalid order amount");

    await supabaseAdmin.from("orders").update({ subtotal, total: amount, status: "pending" }).eq("id", order.id);

    // ---- Reuse a pending payment when the customer retries ----
    const { data: existing } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("order_id", order.id)
      .eq("provider", provider.name)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const merchantReference =
      existing && Number(existing.amount) === amount
        ? existing.merchant_reference
        : `${order.id.replace(/-/g, "").slice(0, 20)}-${Date.now().toString(36)}`;

    if (!existing || Number(existing.amount) !== amount) {
      const { error: insErr } = await supabaseAdmin.from("payments").insert({
        order_id: order.id,
        user_id: order.user_id,
        provider: provider.name,
        merchant_reference: merchantReference,
        amount,
        currency: "EGP",
        status: "pending",
      });
      if (insErr) throw new Error(insErr.message);
    }

    const charge = await provider.createCharge({
      orderId: order.id,
      merchantReference,
      amount,
      currency: "EGP",
      description: `Order ${order.id.slice(0, 8)}`,
      customer: {
        id: context.userId,
        name: String((context.claims as any)?.email ?? "customer").split("@")[0]!,
        email: String((context.claims as any)?.email ?? ""),
        mobile: String(order.phone ?? ""),
      },
      items: chargeItems,
      returnUrl: `${(process.env['FAWRY_RETURN_URL'] ?? '').split('?')[0]}?orderId=${order.id}`,
    });

    await supabaseAdmin
      .from("payments")
      .update({ status: "processing" })
      .eq("merchant_reference", merchantReference);

    return { redirectUrl: charge.redirectUrl, merchantReference };
  });

/** Authoritative payment status for an order (used by the success page). */
export const getOrderPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string }) => {
    if (!d?.orderId || typeof d.orderId !== "string") throw new Error("Invalid orderId");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("order_id", data.orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!payment || payment.user_id !== context.userId) {
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("id,user_id,status,total")
        .eq("id", data.orderId)
        .maybeSingle();
      if (!order || order.user_id !== context.userId) throw new Error("Order not found");
      return { status: order.status, orderStatus: order.status, amount: Number(order.total), transactionId: null, failureReason: null };
    }

    let status = payment.status;
    if (status === "pending" || status === "processing") {
      // Pull the truth from the provider instead of trusting the browser redirect.
      const { getProvider, applyVerification } = await import("@/lib/payments/registry.server");
      const provider = getProvider(payment.provider);
      if (provider.isConfigured()) {
        try {
          const v = await provider.verify(payment.merchant_reference);
          const res = await applyVerification(v, { provider: provider.name });
          status = (res as any).status ?? status;
        } catch (e) {
          console.error("[payments] verify failed", (e as Error).message);
        }
      }
    }

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("status")
      .eq("id", data.orderId)
      .maybeSingle();

    return {
      status,
      orderStatus: order?.status ?? status,
      amount: Number(payment.amount),
      transactionId: payment.transaction_id,
      failureReason: payment.failure_reason,
    };
  });

/** Admin: list payments with optional status filter. */
export const listPaymentsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string }) => ({ status: d?.status ?? "all" }))
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const emails = new Map<string, string>();
    for (const id of userIds) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
      if (u?.user?.email) emails.set(id, u.user.email);
    }

    return (rows ?? []).map((r) => ({
      id: r.id,
      order_id: r.order_id,
      customer: emails.get(r.user_id) ?? r.user_id,
      amount: Number(r.amount),
      currency: r.currency,
      provider: r.provider,
      payment_method: r.payment_method,
      transaction_id: r.transaction_id,
      status: r.status,
      failure_reason: r.failure_reason,
      created_at: r.created_at,
      paid_at: r.paid_at,
    }));
  });

/** Admin-only refund through the provider API (when supported). */
export const refundPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { paymentId: string; reason?: string }) => {
    if (!d?.paymentId) throw new Error("Invalid paymentId");
    return { paymentId: d.paymentId, reason: (d.reason ?? "Customer refund").slice(0, 120) };
  })
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment } = await supabaseAdmin.from("payments").select("*").eq("id", data.paymentId).maybeSingle();
    if (!payment) throw new Error("Payment not found");
    if (payment.status !== "paid") throw new Error("Only paid payments can be refunded");
    if (!payment.transaction_id) throw new Error("Missing provider transaction id");

    const { getProvider } = await import("@/lib/payments/registry.server");
    const provider = getProvider(payment.provider);
    if (!provider.supportsRefund() || !provider.refund) {
      throw new Error("Refund is not available for this provider. Refund manually through the Fawry dashboard/support.");
    }

    const res = await provider.refund({
      transactionId: payment.transaction_id,
      amount: Number(payment.amount),
      reason: data.reason,
    });
    if (!res.ok) throw new Error(res.message ?? "Refund rejected by provider");

    await supabaseAdmin.from("payments").update({ status: "refunded" }).eq("id", payment.id);
    await supabaseAdmin.from("orders").update({ status: "refunded" }).eq("id", payment.order_id);
    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: context.userId,
      actor_email: (context.claims as any)?.email ?? null,
      action: "payment_refunded",
      entity_type: "payment",
      entity_id: payment.id,
      details: { amount: Number(payment.amount), order_id: payment.order_id } as any,
    });

    return { ok: true };
  });
