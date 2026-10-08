# Fawry Payment Setup (Souk el gom3a)

This project integrates **Fawry (FawryPay / Accept) Hosted Checkout** through a pluggable
payment-provider layer. Nothing works until a real Fawry merchant account is issued and its
credentials are stored as **backend secrets**. Until then the Fawry Pay option is shown as
"not activated" at checkout, and every other payment option keeps working exactly as before.

Official documentation (use these only):
- Developer portal: https://developer.fawrystaging.com/
- Hosted checkout (redirect): https://developer.fawrystaging.com/docs/card-tokens/checkout-redirect
- Server callback (V2) & signature: https://developer.fawrystaging.com/docs/server-callback/callback-v2
- Payment status API v2: https://developer.fawrystaging.com/docs/api/apis/#operation/payments-status-v2
- Refund API: https://developer.fawrystaging.com/docs/refund/refund
- Fawry business / merchant onboarding: https://fawry.com/

---

## 1. Open a Fawry merchant account

1. Apply as a merchant at https://fawry.com/ (Business / Accept e-commerce acceptance).
2. Required documents (Egypt): commercial register (سجل تجاري), tax card (بطاقة ضريبية),
   national ID of the owner, bank account details (IBAN) for settlement, and the store URL.
3. Fawry's onboarding team performs a KYC/compliance review and signs the merchant agreement.
4. After approval, you get access to the **Fawry merchant dashboard** and your credentials.

## 2. Credentials you need

| Value | Where to find it |
|---|---|
| **Merchant Code** | Fawry merchant dashboard → *Profile / Integration details*. Sandbox and production codes are different. |
| **Security Key (Secure key)** | Same screen, issued together with the merchant code. Server-side secret. Never expose it. |
| **API base URL** | Sandbox: `https://atfawry.fawrystaging.com` · Production: `https://www.atfawry.com` |
| **Sandbox account** | Register at https://developer.fawrystaging.com/ to get staging merchant code + secure key. |

## 3. Store the secrets in Lovable

Add these as **backend secrets** (never in `.env` committed to git, never in frontend code):

```
FAWRY_ENV=sandbox            # or: production
FAWRY_MERCHANT_CODE=...
FAWRY_SECURITY_KEY=...
FAWRY_API_URL=               # optional override
FAWRY_RETURN_URL=https://<your-domain>/payment-status
FAWRY_CALLBACK_URL=https://<your-domain>/api/public/payments/fawry/webhook
```

Ask the assistant to add them and it will open the secure secret form — do not paste keys into chat.
Sandbox and production keys must never be mixed: switch `FAWRY_ENV` **and** the merchant
code/security key together.

## 4. Return URL

Set `FAWRY_RETURN_URL` to `https://<your-domain>/payment-status`.
The app appends `?orderId=<uuid>` per charge and signs it with the charge request, as documented.
The return page **does not** trust the redirect: it calls the backend, which calls Fawry's
status API v2 before showing "paid".

## 5. Callback / Webhook

In the Fawry merchant dashboard set the **server callback (V2)** URL to:

```
https://<your-domain>/api/public/payments/fawry/webhook
```

The endpoint:
- verifies `messageSignature` = SHA-256 of
  `fawryRefNumber + merchantRefNumber + paymentAmount + orderAmount + orderStatus + paymentMethod + paymentRefrenceNumber + secureKey`
- re-queries Fawry's status API as a second check,
- validates order reference, transaction id, amount and currency against our own database,
- is idempotent (duplicate callbacks are stored once in `payment_events` and ignored),
- never logs secrets or full payloads on signature failure.

### Testing the webhook
1. Do a sandbox payment; Fawry posts the callback automatically.
2. Manual replay: copy a real sandbox callback body and `POST` it with `Content-Type: application/json`.
   A body with a wrong/absent `messageSignature` must return **401** — that proves validation works.
3. Post the same valid body twice: the second call returns `duplicate: true` and changes nothing.

## 6. Sandbox testing

1. `FAWRY_ENV=sandbox` + staging merchant code/secure key.
2. Place an order, choose **Fawry Pay**, you are redirected to the staging Fawry checkout.
3. Use the test cards / test Fawry reference numbers published in the Fawry staging docs.
4. Watch the order in **Admin → Payments**: `pending → processing → paid` only after backend verification.
5. Try an abandoned payment: status must stay `pending`/`failed`, and the order must **not** become paid.

## 7. Going to production

1. Fawry activates the live merchant account and issues production merchant code + secure key.
2. Update the secrets, set `FAWRY_ENV=production`, and point the return/callback URLs to the live domain
   (HTTPS only).
3. Re-register the callback URL in the production dashboard.
4. Do one small real transaction end-to-end and refund it.

## 8. Settlement to your bank account

- Settlement cycle and fees are defined in your Fawry merchant agreement (typically T+1/T+2 business days).
- Check **Settlement / Reconciliation reports** in the Fawry merchant dashboard; each report matches
  the `transaction_id` shown in Admin → Payments.
- Confirm the IBAN registered with Fawry matches your bank account, and reconcile the first payout
  against the report before scaling up.

## 9. Refunds

Admin → Payments → **استرداد** calls Fawry's documented refund API with a signed request.
If your merchant profile does not have the refund API enabled, the call fails with the provider's
message and refunds must be done manually through the Fawry dashboard/support.

## 10. What to obtain from Fawry before going live

- Production merchant code and secure key
- Confirmation that the **server callback V2** is enabled for your account
- Confirmation that the **refund API** is enabled (or that refunds are dashboard-only)
- Allowed payment methods for your account (card, wallet, Fawry reference, valU/instalments)
- Settlement cycle, fees, and the registered settlement IBAN
- Any IP whitelisting requirements on Fawry's side
