/**
 * sessionStorage 기반 예측 캐시 유틸
 * - 탭 닫으면 자동 삭제
 * - TTL 초과 시 자동 무효화
 */

import { PREFETCH_CACHE_TTL } from "@/lib/cache-config";

const CACHE_PREFIX = "arao_prefetch_";
const CACHE_TTL = PREFETCH_CACHE_TTL;
const MAX_PREFETCH_CACHE_BYTES = 150 * 1024; // 150KB
const PRUNE_BATCH_SIZE = 30;

// prunePrefetchCache가 정리 대상으로 포함할 프리픽스 없는 캐시 키 패턴
// 직접 sessionStorage.setItem으로 저장하는 모든 캐시를 여기에 등록할 것
const LEGACY_CACHE_PREFIXES = [
  "user-review-",
  "gallery_",
  "user-review-page-cache-v1:",
  "user-review-list-cache",
  "user-review-list-state",
  "user-review-scroll",
  "user-review-return-once",
  "user-review-last-opened-id",
];

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

function isManagedCacheKey(key: string): boolean {
  if (key.startsWith(CACHE_PREFIX)) return true;
  return LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function extractTimestamp(raw: string): number | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // arao_prefetch_ 구조: { data, timestamp }
    // 레거시 구조: { data, ts }
    const ts = parsed.timestamp ?? parsed.ts;
    const n = Number(ts);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function prunePrefetchCache(keepKey: string): void {
  const now = Date.now();
  const target = `${CACHE_PREFIX}${keepKey}`;
  const entries: Array<{ storageKey: string; timestamp: number }> = [];

  // sessionStorage 순회 중 삭제 시 인덱스 변동 방지를 위해 키 목록 먼저 수집
  const allKeys = Object.keys(sessionStorage);

  // 1) 만료 캐시 즉시 삭제, 유효한 캐시는 entries에 추가
  for (const storageKey of allKeys) {
    if (!isManagedCacheKey(storageKey)) continue;
    if (storageKey === target) continue;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) continue;
      const ts = extractTimestamp(raw);
      if (ts === null) {
        sessionStorage.removeItem(storageKey);
        continue;
      }
      if (now - ts > CACHE_TTL) {
        sessionStorage.removeItem(storageKey);
        continue;
      }
      entries.push({ storageKey, timestamp: ts });
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }

  // 2) 오래된 캐시부터 최대 30개 삭제
  entries
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, PRUNE_BATCH_SIZE)
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
  if (payload.length > MAX_PREFETCH_CACHE_BYTES) return;

  try {
    sessionStorage.setItem(storageKey, payload);
  } catch (error) {
    if (isQuotaExceededError(error)) {
      try {
        prunePrefetchCache(key);
        sessionStorage.setItem(storageKey, payload);
        return;
      } catch (retryError) {
        try {
          clearAllPrefetchCache();
          sessionStorage.setItem(storageKey, payload);
          return;
        } catch {
          return;
        }
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
 * 모든 관리 대상 캐시 삭제 (arao_prefetch_ + LEGACY_CACHE_PREFIXES)
 */
export function clearAllPrefetchCache(): void {
  if (typeof window === "undefined") return;

  try {
    const keys = Object.keys(sessionStorage);
    keys.forEach((key) => {
      if (isManagedCacheKey(key)) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error("[Cache Error] Failed to clear all prefetch cache:", error);
  }
}

/**
 * 로그아웃 시 전체 sessionStorage 캐시 정리
 * - arao_prefetch_ 프리픽스 캐시
 * - 프리픽스 없는 커뮤니티/갤러리 캐시 (user-review-list-cache, gallery_* 등)
 */
export function clearAllCachesOnLogout(): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.clear();
  } catch (error) {
    console.error("[Cache Error] Failed to clear session storage on logout:", error);
  }
}
