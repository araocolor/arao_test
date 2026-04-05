# update_stack.md

## 목적
현재 프로젝트를 유지하면서, 실시간 반응성과 체감 성능(무로딩에 가까운 UX)을 단계적으로 개선한다.

---

## 1) 현재 스택 (As-Is)

- Framework: Next.js (App Router), React, TypeScript
- Auth: Clerk
- DB/Backend: Supabase (API Route + DB)
- Payment: Stripe
- UI/Icon: Tailwind 계열 스타일 + Heroicons/Lucide/Phosphor/Radix
- Cache/State: 컴포넌트 로컬 상태 + sessionStorage/localStorage 기반 캐시
- Realtime: 일부 기능에 개별 적용

---

## 2) 추가/변경 예상 스택 (To-Be)

### 2.1 도입 예정
- Server-state 관리: TanStack Query
- UI 전역 상태: Zustand
- Realtime 표준화: Supabase Realtime 이벤트 규칙 통일
- (선택) Push: FCM 또는 OneSignal

### 2.2 유지/검토
- Auth는 우선 Clerk 유지, 필요 시 Supabase Auth 통합 검토
- 기존 API Route 구조 유지, 데이터 동기화 방식만 표준화

---

## 3) 핵심 개선 목표

1. 커뮤니티/상세/알림/좋아요/댓글에서 즉시 반응 UX 제공
2. 페이지 이동/복귀 시 캐시 일관성 유지
3. 코드 반영 불일치(HMR/캐시) 이슈 최소화
4. 1인 개발 기준으로 유지보수 가능한 규칙 확립

---

## 4) 구현 규칙 (운영 표준)

### 4.1 상태 관리 규칙
- 서버 데이터는 TanStack Query를 source of truth로 사용
- UI 임시 상태는 Zustand 또는 컴포넌트 state로 분리
- sessionStorage/localStorage 캐시는 보조 계층으로만 사용

### 4.2 낙관적 업데이트 규칙
- 좋아요/댓글 좋아요/읽음 처리: optimistic update 기본
- 실패 시 rollback 필수
- 성공 시 관련 쿼리 invalidate 또는 patch

### 4.3 Realtime 규칙
- 이벤트 수신 시 전체 재조회 대신 최소 범위 patch 우선
- 뱃지/카운트/목록 항목 동기화 키를 명확히 정의

### 4.4 성능 규칙
- 주요 라우트 prefetch 기본 적용
- 초기 렌더는 즉시(캐시/SSR 데이터 활용), 백그라운드 재검증
- 스켈레톤은 최소화하고 체감 대기시간을 줄인다

---

## 5) 단계별 적용 계획

## Phase 1 (기반 정리)
- TanStack Query 도입
- Query key 규칙 정의
- 기존 캐시 로직과 충돌 구간 정리

검증:
- 주요 API 응답 캐시/재요청 패턴 확인
- 기존 화면 동작 회귀 없음

## Phase 2 (상호작용 즉시성)
- 본문 좋아요 optimistic + rollback 표준화
- 댓글 좋아요 optimistic + rollback 표준화
- 리스트/상세 카운트 동기화 규칙 적용

검증:
- 클릭 즉시 UI 변경
- 실패 시 정상 복구
- 리스트 복귀 시 카운트 일치

## Phase 3 (알림/실시간)
- 헤더 뱃지 업데이트 경로 통합 (event + realtime + fallback polling)
- 알림 목록/읽음 상태 동기화 표준화

검증:
- 페이지 위치와 관계없이 뱃지 즉시 반영
- 읽음 처리 후 카운트 일관성 유지

## Phase 4 (채팅/고급 UX, 선택)
- 실시간 채팅 모델 도입
- 읽음 상태/미읽음 배지/최근 메시지 동기화

검증:
- 메시지 송수신 지연 최소화
- 앱 재진입 시 최신 상태 복원

---

## 6) 변경 적용 기록 (Change Log)

| 날짜 | 변경 항목 | 적용 상태 | 검증 결과 | 비고 |
|---|---|---|---|---|
| YYYY-MM-DD | 예: 댓글 좋아요 optimistic 적용 | 적용됨 | 통과 | rollback 동작 확인 |
| 2026-04-06 | 알림 ON/OFF를 뱃지 표시 제어로 정리(알림 목록/미읽음 유지, 아이콘 클릭 시 항상 목록 노출) | 적용됨 | 부분검증 | `npm run build` 통과, 브라우저 핵심 플로우 수동 재현은 미수행 |

적용 상태 기준:
- 적용됨
- 부분적용
- 보류
- 미적용

---

## 7) 작업 완료 기준 (DoD)

- 기능 동작 확인(핵심 플로우)
- 화면 반영 확인(코드-UI 일치)
- 실패/예외 시 롤백 또는 에러 메시지 확인
- 변경사항이 본 문서 Change Log에 기록됨

---

## 8) 실행 루틴 (1인 개발 고정 루틴)

1. 기능 수정
2. 핵심 플로우 직접 확인
3. 반영 이상 시 dev 서버 재시작 후 재확인
4. 검증 결과를 `update_stack.md`에 기록
5. 사용자 확인 후 커밋
