// Kashier config — read from environment variables (.env on your own host), never from the browser.
export function getKashierConfig() {
  const secretKey = process.env.KASHIER_SECRET_KEY;
  const apiKey = process.env.KASHIER_API_KEY;
  const merchantId = process.env.KASHIER_MERCHANT_ID;
  const frontendUrl = process.env.FRONTEND_URL;
  const enabled = !!(secretKey && apiKey && merchantId && !String(secretKey).startsWith("xxxxx"));
  return { enabled, mock: !enabled, secretKey, apiKey, merchantId, frontendUrl };
}
