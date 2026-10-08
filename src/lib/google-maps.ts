export function normalizeGoogleMapsUrl(value: string) {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    const isMapsHost =
      host === "maps.app.goo.gl" ||
      (host === "goo.gl" && url.pathname.startsWith("/maps")) ||
      (host === "google.com" && url.pathname.startsWith("/maps")) ||
      (host.endsWith(".google.com") && url.pathname.startsWith("/maps"));

    return url.protocol === "https:" && isMapsHost ? url.toString() : null;
  } catch {
    return null;
  }
}