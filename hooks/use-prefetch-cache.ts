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

  try {
    const cacheData: CacheData<T> = {
      data,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(
      `${CACHE_PREFIX}${key}`,
      JSON.stringify(cacheData)
    );
  } catch (error) {
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
