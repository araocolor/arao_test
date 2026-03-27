# 작업 요약 - 2026-03-27

## 📋 오늘의 주요 작업: 주문 시스템 전체 구현

---

## ✅ 완성된 기능

### 1. CLAUDE.md 개선
- Quick Start에 `.env.local` 설정 추가
- Next.js 16 동적 라우트 `params` Promise 처리 강조
- Pre-Push Checklist 추가
- Common Gotchas 테이블 추가
- Styling & Layout 섹션 추가

### 2. 주문 시스템 전체 구현
**파일 생성:**
- `lib/orders.ts` — 주문 DB 함수 & 타입 정의
- `app/account/orders/page.tsx` — 주문 목록 페이지
- `app/account/orders/[id]/page.tsx` — 주문 상세 페이지
- `app/api/account/orders/route.ts` — 주문 목록 API
- `app/api/account/orders/[id]/route.ts` — 주문 상세 API

**DB 테이블:**
- `products` — 상품 (name, price, currency, active)
- `product_options` — 옵션 (soft/bw/std 등)
- `orders` — 주문 (user_id, total_amount, currency, payment_provider, status)
- `payments` — 결제 정보 (order_id, provider, amount, status 등)

### 3. 기능 상세

**주문 목록 페이지:**
- 사용자 주문 조회 (API: `/api/account/orders`)
- 카드 형식 UI (순번, 금액, 결제상태, 주문일자)
- 카드 클릭 → 상세 페이지 이동

**주문 상세 페이지:**
- 사용자 정보 (username, email from profiles 테이블)
- 주문 정보 (일자, 상태)
- 결제 정보 (제공사, 거래번호, 결제금액, 결제상태)
- 뒤로가기 버튼으로 목록 복귀

---

## 🔧 핵심 기술 & 패턴

### 1. API 라우트 인증 패턴
```typescript
const { userId } = await auth();                    // Clerk 인증
const user = await currentUser();
const profile = await syncProfile({...});           // Supabase 동기화
if (profile?.role !== 'admin') return 403;         // 권한 확인
```

### 2. 데이터 조회 패턴 (user_id 검증)
```typescript
// 1. Orders 테이블에서 user_id 일치 확인
const order = await supabase
  .from("orders")
  .select("*")
  .eq("id", orderId)
  .eq("user_id", userId)  // ← 소유권 검증
  .single();

// 2. Profiles 테이블에서 사용자 정보 조회
const profile = await supabase
  .from("profiles")
  .select("username, email")
  .eq("id", order.user_id)
  .single();
```

### 3. 타입 확장 (상세 정보 통합)
```typescript
export type OrderDetail = Order & {
  payment: Payment;
  user_email?: string;
  user_username?: string;
};
```

---

## ⚠️ 주요 문제 & 해결책

### 문제 1: syncProfile import 오류
**증상:** `Export syncProfile doesn't exist in target module`
**원인:** `lib/consulting` 대신 `lib/profiles`에서 export
**해결:**
```typescript
// ❌ 잘못됨
import { syncProfile } from "@/lib/consulting";

// ✅ 수정됨
import { syncProfile } from "@/lib/profiles";
```

### 문제 2: DB 테이블 스키마 불일치
**증상:** `order_number`, `product_id` 컬럼 없음
**원인:** 예상한 스키마와 실제 DB 구조가 다름
**해결:**
- Supabase에서 실제 테이블 구조 확인
- 타입과 쿼리를 실제 컬럼명으로 수정
- `orders` 테이블: user_id, status, total_amount, currency, payment_provider, created_at

### 문제 3: user_id 표시 방식
**증상:** UUID를 그대로 표시 (사용자 입장에서 무의미)
**원인:** user_id → profiles 테이블 조회 안 함
**해결:**
- getOrderById에서 profiles 조회 추가
- `username, email` 함께 반환
- UI에서 `username, email` 형식으로 표시

---

## 📊 데이터베이스 설계

### Orders 테이블 구조
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | 주문 고유 ID |
| user_id | uuid | 주문자 (profiles FK) |
| status | text | 결제완료/환불진행중/환불완료/결제오류 |
| total_amount | numeric | 주문 금액 |
| currency | text | KRW 등 |
| payment_provider | text | 신한카드 등 |
| created_at | timestamp | 주문 생성 시각 |

### Payments 테이블 구조
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | 결제 고유 ID |
| order_id | uuid | 주문 (orders FK, 1:1) |
| provider | text | 결제사 |
| provider_payment_id | text | 거래번호 |
| status | text | completed/failed 등 |
| amount | numeric | 결제금액 |
| currency | text | KRW 등 |

---

## 🎯 핵심 설계 결정

### 1. 상세페이지: 별도 URL vs 같은 페이지
**선택:** 별도 URL (`/account/orders/[id]`)
**이유:**
- 주문 정보량이 많음
- 뒤로가기 자연스러움
- URL 공유 가능 (CS 대응)

### 2. 주문 구조: 1주문=1상품 vs 다중상품
**선택:** 1주문=1상품
**이유:**
- 초기 스코프 단순화
- order_items 테이블 불필요
- 향후 확장 가능

### 3. 사용자 정보 표시: UUID vs Username
**선택:** Username + Email
**이유:**
- UUID는 사용자 입장에서 무의미
- Username이 실제 사용자 아이디
- Email은 추가 신원 확인

---

## 📝 남은 작업 (Future)

- [ ] 결제 API 연동 (PortOne, Stripe)
- [ ] 환불 기능 (status 상태 전환)
- [ ] 주문 취소 기능
- [ ] 관리자 페이지 (모든 주문 조회)
- [ ] 주문 이력 필터 (상태별, 기간별)
- [ ] 주문 검색 기능

---

## 🚀 빌드 & 배포 상태

**로컬 빌드:** ✅ 성공 (2.5초)
**타입 체크:** ✅ 통과
**API 테스트:** ✅ 완료 (테스트 데이터 1건)
**웹 확인:** ✅ 완료

**마지막 커밋:** `결제상세주문`
