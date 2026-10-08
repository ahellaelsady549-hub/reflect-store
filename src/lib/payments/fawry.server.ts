// Fawry (Accept / FawryPay) payment provider.
// Server-only. Implements the officially documented Fawry Hosted Checkout flow:
//   - Charge request redirect:  {base}/ECommerceWeb/Fawrypay-payments/init?chargeRequest=<json>
//   - Server callback (V2) with `messageSignature`
//   - Server-to-server status:  {base}/ECommerceWeb/Fawrypay-payments/api/payments/status/v2
//   - Refund:                   {base}/ECommerceWeb/Fawrypay-payments/api/payments/refund
// Docs: https://developer.fawrystaging.com/docs/card-tokens/checkout-redirect
import type {
  CreateChargeInput,
  CreateChargeResult,
  PaymentProvider,
  PaymentStatus,
  RefundResult,
  VerifyResult,
} from "./types";

const SANDBOX_BASE = "https://atfawry.fawrystaging.com";
const PRODUCTION_BASE = "https://www.atfawry.com";

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export function fawryConfig() {
  const mode = (env("FAWRY_ENV") ?? "sandbox").toLowerCase() === "production" ? "production" : "sandbox";
  return {
    mode,
    merchantCode: env("FAWRY_MERCHANT_CODE"),
    securityKey: env("FAWRY_SECURITY_KEY"),
    baseUrl: env("FAWRY_API_URL") ?? (mode === "production" ? PRODUCTION_BASE : SANDBOX_BASE),
    returnUrl: env("FAWRY_RETURN_URL"),
  };
}

function money(n: number): string {
  return Number(n).toFixed(2);
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Fawry `orderStatus` -> internal payment status. */
function mapStatus(orderStatus: string | undefined | null): PaymentStatus {
  switch ((orderStatus ?? "").toUpperCase()) {
    case "PAID":
    case "DELIVERED":
      return "paid";
    case "NEW":
    case "UNPAID":
      return "pending";
    case "CANCELED":
    case "CANCELLED":
      return "cancelled";
    case "REFUNDED":
      return "refunded";
    case "EXPIRED":
    case "FAILED":
      return "failed";
    default:
      return "processing";
  }
}

export class FawryPaymentProvider implements PaymentProvider {
  readonly name = "fawry";

  isConfigured(): boolean {
    const c = fawryConfig();
    return Boolean(c.merchantCode && c.securityKey && c.returnUrl);
  }

  private requireConfig() {
    const c = fawryConfig();
    if (!c.merchantCode || !c.securityKey || !c.returnUrl) {
      throw new Error(
        "Fawry is not configured. Missing FAWRY_MERCHANT_CODE / FAWRY_SECURITY_KEY / FAWRY_RETURN_URL.",
      );
    }
    return {
      mode: c.mode,
      baseUrl: c.baseUrl,
      merchantCode: c.merchantCode,
      securityKey: c.securityKey,
      returnUrl: c.returnUrl,
    };
  }

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const c = this.requireConfig();

    // Documented signature: merchantCode + merchantRefNum + customerProfileId +
    // returnUrl + foreach(itemId + itemQuantity + itemPrice[2dp]) + secureKey
    const returnUrl = input.returnUrl ?? c.returnUrl;
    const itemsPart = input.items
      .map((i) => `${i.id}${i.quantity}${money(i.price)}`)
      .join("");
    const signature = await sha256Hex(
      `${c.merchantCode}${input.merchantReference}${input.customer.id}${returnUrl}${itemsPart}${c.securityKey}`,
    );

    const chargeRequest = {
      merchantCode: c.merchantCode,
      merchantRefNum: input.merchantReference,
      customerProfileId: input.customer.id,
      customerName: input.customer.name,
      customerMobile: input.customer.mobile,
      customerEmail: input.customer.email,
      returnUrl,
      authCaptureModePayment: false,
      description: input.description,
      currencyCode: input.currency,
      chargeItems: input.items.map((i) => ({
        itemId: i.id,
        description: i.description,
        price: Number(money(i.price)),
        quantity: i.quantity,
      })),
      signature,
    };

    const redirectUrl = `${c.baseUrl}/ECommerceWeb/Fawrypay-payments/init?chargeRequest=${encodeURIComponent(
      JSON.stringify(chargeRequest),
    )}`;

    return { redirectUrl, transactionId: null };
  }

  async verify(merchantReference: string): Promise<VerifyResult> {
    const c = this.requireConfig();
    const signature = await sha256Hex(`${c.merchantCode}${merchantReference}${c.securityKey}`);
    const url =
      `${c.baseUrl}/ECommerceWeb/Fawrypay-payments/api/payments/status/v2` +
      `?merchantCode=${encodeURIComponent(c.merchantCode)}` +
      `&merchantRefNumber=${encodeURIComponent(merchantReference)}` +
      `&signature=${signature}`;

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      return {
        status: "processing",
        transactionId: null,
        amount: null,
        currency: null,
        merchantReference,
        paymentMethod: null,
        failureReason: `Fawry status API returned ${res.status}`,
        raw: null,
      };
    }
    const body = (await res.json()) as Record<string, any>;
    return {
      status: mapStatus(body["orderStatus"]),
      transactionId: body["fawryRefNumber"] ? String(body["fawryRefNumber"]) : null,
      amount: body["paymentAmount"] != null ? Number(body["paymentAmount"]) : null,
      currency: body["currencyCode"] ? String(body["currencyCode"]) : "EGP",
      merchantReference: body["merchantRefNumber"] ? String(body["merchantRefNumber"]) : merchantReference,
      paymentMethod: body["paymentMethod"] ? String(body["paymentMethod"]) : null,
      failureReason: body["statusDescription"] ? String(body["statusDescription"]) : null,
      raw: body,
    };
  }

  async parseCallback(body: unknown): Promise<(VerifyResult & { eventKey: string }) | null> {
    const c = this.requireConfig();
    if (!body || typeof body !== "object") return null;
    const b = body as Record<string, any>;

    const fawryRefNumber = b["fawryRefNumber"] != null ? String(b["fawryRefNumber"]) : "";
    const merchantRefNumber = b["merchantRefNumber"] != null ? String(b["merchantRefNumber"]) : "";
    const paymentAmount = b["paymentAmount"];
    const orderAmount = b["orderAmount"];
    const orderStatus = b["orderStatus"] != null ? String(b["orderStatus"]) : "";
    const paymentMethod = b["paymentMethod"] != null ? String(b["paymentMethod"]) : "";
    const paymentRefrenceNumber =
      b["paymentReferenceNumber"] != null
        ? String(b["paymentReferenceNumber"])
        : b["paymentRefrenceNumber"] != null
          ? String(b["paymentRefrenceNumber"])
          : "";
    const received = b["messageSignature"] != null ? String(b["messageSignature"]).toLowerCase() : "";

    if (!merchantRefNumber || !received) return null;

    // Documented V2 callback signature:
    // fawryRefNumber + merchantRefNum + paymentAmount[2dp] + orderAmount[2dp] +
    // orderStatus + paymentMethod + paymentRefrenceNumber + secureKey
    const expected = await sha256Hex(
      `${fawryRefNumber}${merchantRefNumber}${money(Number(paymentAmount ?? 0))}${money(
        Number(orderAmount ?? 0),
      )}${orderStatus}${paymentMethod}${paymentRefrenceNumber}${c.securityKey}`,
    );
    if (!timingSafeEqualHex(received, expected)) return null;

    return {
      eventKey: `${merchantRefNumber}:${fawryRefNumber}:${orderStatus}`,
      status: mapStatus(orderStatus),
      transactionId: fawryRefNumber || null,
      amount: paymentAmount != null ? Number(paymentAmount) : null,
      currency: b["currencyCode"] ? String(b["currencyCode"]) : "EGP",
      merchantReference: merchantRefNumber,
      paymentMethod: paymentMethod || null,
      failureReason: b["failureErrorCode"] ? String(b["failureReason"] ?? b["failureErrorCode"]) : null,
      raw: b,
    };
  }

  supportsRefund(): boolean {
    return this.isConfigured();
  }

  async refund(input: { transactionId: string; amount: number; reason: string }): Promise<RefundResult> {
    const c = this.requireConfig();
    const signature = await sha256Hex(
      `${c.merchantCode}${input.transactionId}${money(input.amount)}${input.reason ?? ""}${c.securityKey}`,
    );
    const res = await fetch(`${c.baseUrl}/ECommerceWeb/Fawrypay-payments/api/payments/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        merchantCode: c.merchantCode,
        referenceNumber: input.transactionId,
        refundAmount: Number(money(input.amount)),
        reason: input.reason,
        signature,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, any>;
    const ok = res.ok && Number(body["statusCode"] ?? 200) === 200;
    return { ok, message: body["statusDescription"] ? String(body["statusDescription"]) : undefined };
  }
}

export const fawryProvider = new FawryPaymentProvider();
