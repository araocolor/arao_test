function toSingleString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

export function normalizeRedirectPath(value: unknown): string | null {
  const raw = toSingleString(value)?.trim();
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  return raw;
}

export function buildSignInHrefFromCurrentLocation(): string {
  if (typeof window === "undefined") {
    return "/sign-in";
  }

  const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const redirectPath = normalizeRedirectPath(path);
  if (!redirectPath) return "/sign-in";
  return `/sign-in?redirect_url=${encodeURIComponent(redirectPath)}`;
}
