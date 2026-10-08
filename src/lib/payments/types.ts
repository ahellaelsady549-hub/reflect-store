// Provider-agnostic payment layer types (client-safe: types only).

export type PaymentStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

export interface CreateChargeInput {
  orderId: string;
  merchantReference: string;
  amount: number;
  currency: string;
  description: string;
  customer: {
    id: string;
    name: string;
    email: string;
    mobile: string;
  };
  items: Array<{ id: string; description: string; price: number; quantity: number }>;
  /** Optional per-charge return URL (must be signed with the request). */
  returnUrl?: string;
}

export interface CreateChargeResult {
  /** URL the customer must be redirected to in order to pay. */
  redirectUrl: string;
  /** Provider transaction id when already known at creation time. */
  transactionId?: string | null;
}

export interface VerifyResult {
  status: PaymentStatus;
  transactionId: string | null;
  amount: number | null;
  currency: string | null;
  merchantReference: string | null;
  paymentMethod: string | null;
  failureReason: string | null;
  raw: unknown;
}

export interface RefundResult {
  ok: boolean;
  message?: string;
}

export interface PaymentProvider {
  readonly name: string;
  /** True when all required credentials/env vars are configured. */
  isConfigured(): boolean;
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
  /** Server-to-server verification, the only source of truth for "paid". */
  verify(merchantReference: string): Promise<VerifyResult>;
  /** Validate + normalize an inbound callback body. Returns null if signature invalid. */
  parseCallback(body: unknown): Promise<(VerifyResult & { eventKey: string }) | null>;
  supportsRefund(): boolean;
  refund?(input: { transactionId: string; amount: number; reason: string }): Promise<RefundResult>;
}
