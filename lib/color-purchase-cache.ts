"use client";

import { COLOR_LIST_CACHE_TTL } from "@/lib/cache-config";

type PurchasedColorCacheSnapshot = {
  ids: string[];
  ts: number;
};

const PURCHASE_CACHE_KEY = "color-purchased-cache-v1";

function normalizeIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return ids
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

export function getCachedPurchasedColorIds(options?: { includeExpired?: boolean }): string[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(PURCHASE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PurchasedColorCacheSnapshot;
    if (!Number.isFinite(parsed?.ts)) return null;
    const expired = Date.now() - parsed.ts > COLOR_LIST_CACHE_TTL;
    if (expired && options?.includeExpired !== true) return null;
    return normalizeIds(parsed.ids);
  } catch {
    return null;
  }
}

export function setCachedPurchasedColorIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      PURCHASE_CACHE_KEY,
      JSON.stringify({
        ids: [...new Set(normalizeIds(ids))],
        ts: Date.now(),
      } satisfies PurchasedColorCacheSnapshot)
    );
  } catch {}
}

export function markPurchasedColorId(colorId: string): void {
  if (typeof window === "undefined") return;
  const normalized = colorId.trim();
  if (!normalized) return;
  const current = getCachedPurchasedColorIds({ includeExpired: true }) ?? [];
  if (current.includes(normalized)) {
    setCachedPurchasedColorIds(current);
    return;
  }
  setCachedPurchasedColorIds([...current, normalized]);
}

export async function refreshPurchasedColorIdsCache(): Promise<string[] | null> {
  if (typeof window === "undefined") return null;
  try {
    const response = await fetch("/api/account/purchased-colors", { cache: "no-store" });
    if (!response.ok) return null;
    const json = (await response.json()) as { purchasedColorIds?: unknown };
    const ids = normalizeIds(json.purchasedColorIds);
    setCachedPurchasedColorIds(ids);
    return ids;
  } catch {
    return null;
  }
}
