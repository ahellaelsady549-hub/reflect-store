// Fawry server callback (V2). External caller -> must live under /api/public/*.
// Security: signature verified with the merchant secure key, amount/currency/reference
// re-validated against our database, replays de-duplicated via payment_events.
import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const SECURE_HEADERS = {
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
  ...CORS,
} as const;

export const Route = createFileRoute("/api/public/payments/fawry/webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const raw = await request.text();
          if (raw.length > 100_000) {
            return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: SECURE_HEADERS });
          }
          let body: unknown;
          try {
            body = JSON.parse(raw);
          } catch {
            return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: SECURE_HEADERS });
          }

          const { getProvider, applyVerification } = await import("@/lib/payments/registry.server");
          const provider = getProvider("fawry");
          if (!provider.isConfigured()) {
            return new Response(JSON.stringify({ error: "Provider not configured" }), { status: 503, headers: SECURE_HEADERS });
          }

          const parsed = await provider.parseCallback(body);
          if (!parsed) {
            // Never log secrets or the full payload on signature failure.
            console.warn("[fawry-webhook] rejected: invalid signature");
            return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: SECURE_HEADERS });
          }

          // Cross-check with the provider's status API before trusting the callback.
          let verified = parsed;
          try {
            const s = await provider.verify(parsed.merchantReference!);
            if (s.status !== "processing") verified = { ...parsed, ...s, eventKey: parsed.eventKey };
          } catch {
            /* fall back to the signed callback payload */
          }

          const result = await applyVerification(verified, { provider: "fawry", eventKey: parsed.eventKey });
          return new Response(JSON.stringify(result), { status: 200, headers: SECURE_HEADERS });
        } catch (error) {
          console.error("[fawry-webhook] error", (error as Error).message);
          return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: SECURE_HEADERS });
        }
      },
    },
  },
});
