/**
 * sessionStorage 기반 예측 캐시 유틸
 * - 탭 닫으면 자동 삭제
 * - TTL(5분) 초과 시 자동 무효화
 */

const CACHE_PREFIX = "arao_prefetch_";
const CACHE_TTL = 60 * 1000; // 1분

interface CacheData<T> {
  data: T;
  timestamp: number;
}

function isQuotaExceededError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  return (
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error.code === 22 ||
    error.code === 1014
  );
}

function prunePrefetchCache(keepKey: string): void {
  const now = Date.now();
  const target = `${CACHE_PREFIX}${keepKey}`;
  const prefetchEntries: Array<{ storageKey: string; timestamp: number }> = [];

  // 1) 만료 캐시는 즉시 삭제
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const storageKey = sessionStorage.key(i);
    if (!storageKey || !storageKey.startsWith(CACHE_PREFIX)) continue;
    if (storageKey === target) continue;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as CacheData<unknown>;
      const ts = Number(parsed.timestamp);
      if (!Number.isFinite(ts)) {
        sessionStorage.removeItem(storageKey);
        continue;
      }
      if (now - ts > CACHE_TTL) {
        sessionStorage.removeItem(storageKey);
        continue;
      }
      prefetchEntries.push({ storageKey, timestamp: ts });
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }

  // 2) 오래된 캐시부터 최대 10개 삭제
  prefetchEntries
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, 10)
    .forEach((entry) => {
      try {
        sessionStorage.removeItem(entry.storageKey);
      } catch {}
    });
}

/**
 * 캐시에서 데이터 읽기
 * @returns TTL 유효한 데이터 또는 null
 */
export function getCached<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const item = sessionStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!item) return null;

    const cached: CacheData<T> = JSON.parse(item);
    const isExpired = Date.now() - cached.timestamp > CACHE_TTL;

    if (isExpired) {
      clearCached(key);
      return null;
    }

    return cached.data;
  } catch (error) {
    console.error(`[Cache Error] Failed to get cache for ${key}:`, error);
    return null;
  }
}

/**
 * 캐시에 데이터 저장
 */
export function setCached<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;

  const storageKey = `${CACHE_PREFIX}${key}`;
  const cacheData: CacheData<T> = {
    data,
    timestamp: Date.now(),
  };
  const payload = JSON.stringify(cacheData);

  try {
    sessionStorage.setItem(storageKey, payload);
  } catch (error) {
    if (isQuotaExceededError(error)) {
      try {
        prunePrefetchCache(key);
        sessionStorage.setItem(storageKey, payload);
        return;
      } catch (retryError) {
        console.error(`[Cache Error] Quota recovery failed for ${key}:`, retryError);
        return;
      }
    }
    console.error(`[Cache Error] Failed to set cache for ${key}:`, error);
  }
}

/**
 * 캐시 삭제
 */
export function clearCached(key: string): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch (error) {
    console.error(`[Cache Error] Failed to clear cache for ${key}:`, error);
  }
}

/**
 * 모든 prefetch 캐시 삭제
 */
export function clearAllPrefetchCache(): void {
  if (typeof window === "undefined") return;

  try {
    const keys = Object.keys(sessionStorage);
    keys.forEach((key) => {
      if (key.startsWith(CACHE_PREFIX)) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error("[Cache Error] Failed to clear all prefetch cache:", error);
  }
}
