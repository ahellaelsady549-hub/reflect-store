export function sanitizeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  const candidate = value.trim();
  if (!candidate) return null;

  if (candidate.startsWith("blob:") || candidate.startsWith("data:image/")) {
    const ok = /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(candidate) || candidate.startsWith("blob:");
    return ok ? candidate : null;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {
    return null;
  }

  return null;
}

export function isSafeImageSource(value: string | null | undefined): boolean {
  return sanitizeImageUrl(value) !== null;
}
