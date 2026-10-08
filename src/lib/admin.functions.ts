import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

async function logAudit(
  context: { supabase: any; userId: string; claims: any },
  action: string, entityType: string, entityId: string | null, details: Record<string, unknown>,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("admin_audit_log").insert({
    actor_id: context.userId,
    actor_email: (context.claims?.email as string) ?? null,
    action, entity_type: entityType, entity_id: entityId, details: details as any,
  });
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw error;
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name");
    const nameMap = new Map((profiles || []).map((p) => [p.id, p.full_name]));
    return data.users.map((u) => ({
      id: u.id, email: u.email ?? "", created_at: u.created_at,
      full_name: (nameMap.get(u.id) as string | null) ?? "",
    }));
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("Cannot delete self");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw error;
    await logAudit(context, "delete", "user", data.userId, { email: target?.user?.email ?? null });
    return { ok: true };
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string; status: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const allowed = ["pending", "paid", "processing", "shipped", "delivered", "cancelled"];
    if (!allowed.includes(data.status)) throw new Error("Invalid status");
    const { error } = await context.supabase.from("orders").update({ status: data.status }).eq("id", data.orderId);
    if (error) throw error;
    await logAudit(context, "update", "order", data.orderId, { status: data.status });
    return { ok: true };
  });

export const adminReplyMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; body: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const body = data.body.trim();
    if (!body) throw new Error("Empty");
    const { error } = await context.supabase.from("support_messages").insert({
      user_id: data.userId, sender_role: "admin", body: body.slice(0, 4000), read_by_admin: true,
    });
    if (error) throw error;
    return { ok: true };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (role) throw new Error("Admin account cannot be deleted");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const notifyAccountChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: "email_change" | "password_change" }) => {
    if (d.kind !== "email_change" && d.kind !== "password_change") throw new Error("Invalid kind");
    return { kind: d.kind };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = target?.user?.email ?? "";
    const message = data.kind === "email_change"
      ? `المستخدم غيّر بريده الإلكتروني (${email})`
      : `المستخدم غيّر كلمة المرور (${email})`;
    await supabaseAdmin.from("admin_notifications").insert({
      user_id: context.userId, kind: data.kind, message,
    });
    return { ok: true };
  });


export const updateProductPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { productId: string; price: number; discount_percent?: number; stock?: number }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!Number.isFinite(data.price) || data.price <= 0) throw new Error("Invalid price");
    const patch: any = { price: data.price };
    if (data.discount_percent !== undefined) patch.discount_percent = Math.max(0, Math.min(100, data.discount_percent));
    if (data.stock !== undefined) patch.stock = Math.max(0, Math.floor(data.stock));
    const { error } = await context.supabase.from("products").update(patch).eq("id", data.productId);
    if (error) throw error;
    await logAudit(context, "update", "product", data.productId, patch);
    return { ok: true };
  });

export const listAdminOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data: orders, error } = await context.supabase
      .from("orders")
      .select("id,total,status,payment_method,phone,backup_phone,shipping_address,google_maps_url,created_at,user_id,order_items(product_name,quantity,unit_price,product_id)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((orders ?? []).map((o: any) => o.user_id).filter(Boolean)));
    if (!userIds.length) return (orders ?? []).map((o: any) => ({ ...o, customer_name: null, customer_email: null }));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds);
    const nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));
    const emailMap = new Map<string, string>();
    await Promise.all(userIds.map(async (uid) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(uid as string);
      if (data?.user?.email) emailMap.set(uid as string, data.user.email);
    }));
    return (orders ?? []).map((o: any) => ({
      ...o,
      customer_name: (nameMap.get(o.user_id) as string) ?? null,
      customer_email: emailMap.get(o.user_id) ?? null,
    }));
  });
