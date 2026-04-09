/**
 * 캐시 TTL 중앙 관리
 * 모든 캐시 만료 시간은 여기서 정의하고 import해서 사용할 것.
 */

/** sessionStorage 기본 prefetch 캐시 TTL (1분) */
export const PREFETCH_CACHE_TTL = 60 * 1000;

/** 커뮤니티 리스트 캐시 TTL (5분) */
export const REVIEW_LIST_CACHE_TTL = 5 * 60 * 1000;

/** 알림 캐시 TTL (1분) */
export const NOTIFICATION_CACHE_TTL = 60 * 1000;

/** React Query staleTime (30초) — query-provider.tsx 에서 사용 */
export const QUERY_STALE_TIME = 30 * 1000;
