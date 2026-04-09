# 캐싱 전략 개선 계획

> 분석일: 2026-04-10  
> 사용자가 "개선사항 보여줘"라고 요청할 때만 이 문서를 참조하여 각 항목의 완료 여부를 확인할 것.

---

## 사용 방법

- `[ ]` = 미완료
- `[x]` = 완료
- 각 항목 하단에 **완료 시 변경된 파일과 일자를 기록**할 것

---

## 심각도 분류

| 심각도 | 색상 | 기준 |
|--------|------|------|
| Critical | 🔴 | 데이터 신선도 예측 불가, 전체 캐시 신뢰 붕괴 |
| High | 🟠 | 보안·데이터 무결성·메모리 누수 |
| Medium | 🟡 | 성능·안정성·유지보수성 |

---

## 🔴 Critical

### C1. TTL 상수 통합
- **문제**: TTL이 5곳에 흩어져 혼재
  - `use-prefetch-cache.ts:8` → 1분
  - `query-provider.tsx:12` → 30초
  - `account-prefetch-wrapper.tsx:10` → 5분 (리뷰)
  - `header-profile-link.tsx:13` → 5분 (리뷰), 17 → 1분 (알림)
  - `main-user-review-page.tsx:17` → 5분
- **영향**: 어떤 캐시가 최신인지 예측 불가, 데이터 신선도 기준 없음
- **해결**: `lib/cache-config.ts` 단일 파일로 모든 TTL 상수 통합
- **체크리스트**:
  - [x] `lib/cache-config.ts` 생성 (TTL 상수 정의)
  - [x] 흩어진 TTL 상수 import로 교체
  - [x] 주석의 TTL 수치와 실제 코드 일치 여부 확인 (`use-gallery-prefetch.ts:6` "5분" 주석 vs 실제 1분)

> **완료 기록**: 2026-04-10 — `lib/cache-config.ts` 생성. `use-prefetch-cache.ts`, `query-provider.tsx`, `account-prefetch-wrapper.tsx`, `header-profile-link.tsx`, `site-header.tsx`, `main-user-review-page.tsx` 수정. 주석 불일치(`use-gallery-prefetch.ts`) 수정.

---

## 🟠 High

### H1. 로그아웃 시 전체 캐시 정리 (보안)
- **문제**: `signOut()` 후 `window.location.href` 이동만 하고 sessionStorage 정리 없음
  - `header-logout-button.tsx:22`
  - `use-inactivity-logout.ts:28`
- **영향**: 다음 사용자가 이전 사용자의 개인 데이터(주문, 설정, 컨설팅) 접근 가능 — **보안 취약점**
- **해결**: 로그아웃 전 `clearAllPrefetchCache()` + 프리픽스 없는 캐시 키 목록 일괄 삭제
- **체크리스트**:
  - [x] `use-prefetch-cache.ts`에 `clearAllCachesOnLogout()` (전체 sessionStorage.clear()) 함수 추가
  - [x] `header-logout-button.tsx` signOut 전 호출
  - [x] `use-inactivity-logout.ts` signOut 전 호출
  - [ ] 로그인 상태 전환 시 guest 캐시 정리 확인

> **완료 기록**: 2026-04-10 — `clearAllCachesOnLogout()` 추가 (`use-prefetch-cache.ts`). `header-logout-button.tsx`, `use-inactivity-logout.ts` 호출 추가.

---

### H2. 캐시 키 프리픽스 통일 및 prunePrefetchCache 적용 범위 확대
- **문제**: `arao_prefetch_` 프리픽스 없는 캐시들이 `prunePrefetchCache()`에서 정리 안 됨
  - `user-review-list-cache` (account-prefetch-wrapper.tsx:62)
  - `gallery_public_*` (account-prefetch-wrapper.tsx:76)
  - `gallery_card_*` (gallery-card.tsx:78)
  - `gallery_comments_*`, `user-review-likes-*`, `user-review-comments-*`
- **영향**: 정리 안 되는 캐시 무한 누적 → sessionStorage 고갈
- **해결**: 모든 캐시 키에 `arao_` 프리픽스 적용 또는 등록 기반 정리 메커니즘 도입
- **체크리스트**:
  - [x] 프리픽스 없는 캐시 키 전수 조사
  - [x] `clearAllPrefetchCache()` 가 `LEGACY_CACHE_PREFIXES` 포함하도록 수정
  - [x] QuotaExceededError 복구 시 `prunePrefetchCache`가 전체 캐시 커버
  - [x] `prunePrefetchCache` 순회 버그 수정 (삭제 중 인덱스 변동 → `Object.keys()` 먼저 수집)

> **완료 기록**: 2026-04-10 — `use-prefetch-cache.ts`에 `LEGACY_CACHE_PREFIXES`, `isManagedCacheKey()`, `extractTimestamp()` 추가. `prunePrefetchCache` / `clearAllPrefetchCache` 전체 캐시 대상으로 확장.

---

### H3. sessionStorage 접근 방식 단일화
- **문제**: 4가지 방식으로 sessionStorage 직접 접근
  - `setCached()` 유틸 (arao_prefetch_ 프리픽스)
  - `account-prefetch-wrapper.tsx:62` 직접 `sessionStorage.setItem`
  - `header-profile-link.tsx:53-58` 직접 `sessionStorage.setItem`
  - `user-content-interactions.tsx:107-111` 직접 `sessionStorage.setItem`
- **영향**: 캐시 구조 파악 불가, 정리 불가, 유지보수 불능
- **해결**: 모든 sessionStorage 접근을 `use-prefetch-cache.ts`의 `setCached`/`getCached` 경유로 통일
- **체크리스트**:
  - [ ] `account-prefetch-wrapper.tsx` 직접 접근 → `setCached()` 교체
  - [ ] `header-profile-link.tsx` 직접 접근 → `setCached()` 교체
  - [ ] `user-content-interactions.tsx` 직접 접근 → `setCached()` 교체

> **완료 기록**: (미완료)

---

### H4. 캐시 무효화(Invalidation) 전략 추가
- **문제**: 좋아요/댓글 변경 후 관련 list 캐시 업데이트 없음
  - `gallery-card.tsx:266-280` 좋아요 클릭 후 `gallery_card_*` 만 업데이트
  - `user-review-list-cache`는 미업데이트
- **영향**: 다른 탭/컴포넌트에서 stale 데이터 지속 노출
- **해결**: 데이터 변경 이벤트 시 관련 캐시 무효화 함수 추가
- **체크리스트**:
  - [ ] `invalidateGalleryCache(category, index)` 유틸 함수 작성
  - [ ] 좋아요/댓글 변경 후 호출 지점 추가
  - [ ] 리뷰 목록 캐시 무효화 연동

> **완료 기록**: (미완료)

---

## 🟡 Medium

### M1. 경쟁 상태(Race Condition) 방지
- **문제**: `gallery-card.tsx:148-212` useEffect 다중 실행 시 setCached() 순서 보장 안 됨
- **해결**: AbortController + 요청 중복 방지 ref 패턴 적용
- **체크리스트**:
  - [ ] `gallery-card.tsx` useEffect에 AbortController 추가
  - [ ] fetch 중 언마운트 시 abort 처리

> **완료 기록**: (미완료)

---

### M2. 타입 안전한 캐시 복원
- **문제**: `getCached<T>()` 반환 시 JSON.parse 후 타입 assertion만, 런타임 검증 없음 (`use-prefetch-cache.ts:71-91`)
- **영향**: 캐시 손상 시 TypeError 조용히 발생
- **해결**: 간단한 shape 검증 또는 try-catch 강화
- **체크리스트**:
  - [ ] `getCached()` 내 파싱 실패 시 자동 `clearCached()` 호출 추가
  - [ ] 에러 로그에 캐시 키 포함

> **완료 기록**: (미완료)

---

### M3. 중복 prefetch 락 전체 적용
- **문제**: 리뷰 목록만 10초 락 적용, 나머지 prefetch는 락 없음
  - `account-prefetch-wrapper.tsx:52-60`
- **영향**: 빠른 재방문 시 중복 API 요청 발생
- **해결**: `useAccountPrefetch`, `useGalleryPrefetch` 에도 락 메커니즘 추가
- **체크리스트**:
  - [ ] prefetch 함수별 in-flight 락 ref 추가
  - [ ] 캐시 히트 시 조기 반환 확인

> **완료 기록**: (미완료)

---

## 진행 현황 요약

| 항목 | 심각도 | 상태 |
|------|--------|------|
| C1. TTL 상수 통합 | 🔴 Critical | ✅ 완료 (2026-04-10) |
| H1. 로그아웃 캐시 정리 | 🟠 High (보안) | ✅ 완료 (2026-04-10) |
| H2. 캐시 키 프리픽스 통일 | 🟠 High | ✅ 완료 (2026-04-10) |
| H3. sessionStorage 접근 단일화 | 🟠 High | ⬜ 미완료 |
| H4. 캐시 무효화 전략 | 🟠 High | ⬜ 미완료 |
| M1. Race Condition 방지 | 🟡 Medium | ⬜ 미완료 |
| M2. 타입 안전한 캐시 복원 | 🟡 Medium | ⬜ 미완료 |
| M3. 중복 prefetch 락 | 🟡 Medium | ⬜ 미완료 |
