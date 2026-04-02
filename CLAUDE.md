# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. See **frontend.md**, **backend.md**, and **share.md** for detailed specifications.

> **레이아웃 수정 요청 시** → **LAYOUT_MAP.md** 를 먼저 참조. 구역명(헤더, 히어로, 계정 > 하단탭 등)으로 파일과 클래스를 즉시 찾을 수 있음.

## 체크리스트

- [ ] 이미지는 Supabase Storage에 업로드 후 URL만 DB에 저장 (base64 DB 직접 저장 금지)
- [ ] 커뮤니티 이미지 저장 방식을 Supabase Storage URL 방식으로 전환

## Quick Start

```bash
npm install                    # Install dependencies
cp .env.example .env.local     # Copy environment template
# Edit .env.local with Supabase and Clerk credentials
npm run dev                    # Start dev server (localhost:3000)
npm run build                  # Build for production
npm run start                  # Start production server
npm run lint                   # Check code quality
```

**Available ports:** Dev uses port 3000 (or 3001 if 3000 is in use)

## Project Overview

**Arao** is a Next.js expansion architecture converting a static landing site into a full-stack service platform with user authentication, admin content management, and consultation/inquiry system with notifications.

- **Framework:** Next.js 16 (App Router)
- **Auth:** Clerk (session-based, 1-hour expiration)
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (`landing-assets` bucket)
- **Payments:** PortOne, Stripe (currently stubs)
- **Deployment:** Vercel (auto-deploy from GitHub)
- **Language:** TypeScript
- **Status:** Production (https://arao-test-7gxt.vercel.app)

## Core Concepts

### Client-Server Architecture
- **Server Components:** Data fetching, auth checks, admin operations
- **Client Components:** Interactive UI with state management
- **API Routes:** Bridge for client operations requiring auth/permissions
- **Import alias:** `@/` maps to project root (use `@/components`, `@/lib`, `@/hooks`)

### Authentication & Protected Routes
- Users log in via Clerk (`/sign-in`, `/sign-up`)
- `syncProfile()` auto-creates Supabase profiles on first login
- **Middleware** (`middleware.ts`) enforces auth via `clerkMiddleware()`:
  - `/admin/*` — Admin only (requires `profiles.role = 'admin'`)
  - `/account/*` — Authenticated users only
  - `/article/*` — Admin only
  - All other routes are public

### Critical: Next.js 16 Dynamic Routes
Dynamic routes now require awaiting `params` (it's a Promise). TypeScript won't catch missed awaits:
```typescript
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;  // ← Must await!
  // Rest of logic
}
```
See **backend.md** for API route patterns.

### Key Features
- User profile management with custom avatar upload
- Admin content/pricing editing
- 1:1 consultation system (create, reply, track status)
- Order system (list, detail, status tracking)
- Unified notification system (6 types: settings, orders, consulting, reviews, gallery)
- Reviews board with replies and likes
- Gallery with Instagram-style card UI (likes, comments, emoji bar, drag-dismiss sheet)
- Real-time notification badges (Supabase Realtime — `notifications` + `inquiries` 테이블 구독)

## Gallery Card UI (Instagram Style)

갤러리 페이지(`/gallery`)는 각 이미지를 `GalleryCard` 컴포넌트로 래핑합니다.

- **`components/gallery-card.tsx`** — 이미지 + 인터랙션 바 (하트/댓글/공유) + 좋아요 문구 + 설명
  - 하트: `likeCount >= 1` 이면 `#FF2D2D` (로고 빨간색) 채움
  - 좋아요 문구: `<strong>` 으로 아이디/N명 부분만 bold
- **`components/gallery-comment-sheet.tsx`** — 바텀 시트 댓글창
  - 높이 `70vh` (확장 시 `100dvh`), 드래그 다운 닫기, 외부 클릭 슬라이드 다운
  - 이모지 바 (40개), 이메일 마스킹 (`ch***@gmail.com`), 아바타 표시
  - input `font-size: 16px` 필수 (iOS 줌 방지)
  - Supabase Realtime으로 다른 사용자 댓글 실시간 반영 (`commentsRef`로 중복 방지)
- **`lib/gallery-interactions.ts`** — 좋아요/댓글 DB 로직 (admin 클라이언트, `GalleryComment` 타입 정의)
- **API:** `/api/gallery/[category]/[index]/likes`, `/api/gallery/[category]/[index]/comments`, `/api/gallery/comments/[id]/likes`, `/api/gallery/[category]/[index]/likes/users`
- **DB 테이블:** `gallery_item_likes`, `gallery_comments`, `gallery_comment_likes` (RLS 비활성화)
- **Supabase Realtime 필수 설정:** 아래 4개 테이블은 `supabase_realtime` publication에 추가되어 있어야 함
  ```sql
  alter publication supabase_realtime add table gallery_item_likes;
  alter publication supabase_realtime add table gallery_comments;
  alter publication supabase_realtime add table notifications;
  alter publication supabase_realtime add table inquiries;
  ```
- **`autoOpenLikes` prop:** URL에 `likesSheet=1` 파라미터 있으면 좋아요 누른 사용자 시트 자동 오픈
- **`/api/gallery/[category]/[index]/likes/users`** — 좋아요 누른 사용자 목록 API (시트에서 사용)
- **좋아요 시트 → 사용자 프로필 이동:** 시트에서 아이디 클릭 시 `/usercolor/[profileId]` 또는 `/account/userpage`로 이동. 돌아오면 `likesSheet=1&t=` 파라미터로 좋아요 시트 복원
- **아이디 없는 사용자 댓글:** `profile_id`로 저장됨 — 아이디 없어도 DB에 정상 저장됨

## Headers

- **`components/landing-page-header.tsx`** — 공개 페이지용 (햄버거 + 캐릭터)
- **`components/simple-header.tsx`** (헤더2) — `/account/*` 전용, 로고만 가운데
- 계정 레이아웃(`app/account/layout.tsx`)은 `SimpleHeader` 사용
- 메뉴 순서: ARAO 소개 → 갤러리 → 커뮤니티 → 설치방법 → 구매가이드 / 사용자설정

## Icon Libraries

- **`@heroicons/react/24/outline`** — 사이트 헤더 드로어 메뉴 아이콘 (`site-header.tsx`)
- **`lucide-react`** — 계정 풋터 아이콘 (`account-nav-links.tsx`)
- `/lucide` — 아이콘 레퍼런스 페이지 (검색 기능 포함)

## Notification Drawer

`components/notification-drawer.tsx` — 헤더 캐릭터 클릭 시 표시

- 헤더: 왼쪽 화살표(닫기) + 아이디/이메일(가운데) + 설정 아이콘(오른쪽)
- 아이디 없으면 이메일 표시
- 새 알림(is_read=false): 노란색 배경 강조
- consulting 알림: `notifications` 테이블 조회 시 `.neq("type","consulting")` 필수 → `lib/notifications.ts`에서 `inquiries` 쿼리로 별도 처리
- **레이아웃:** 모바일(≤480px) 전체화면, 태블릿/웹(≥481px) 500px 오른쪽 정렬
- **애니메이션:** 오른쪽에서 슬라이드 인(1000ms) / 모바일 닫기: 오른쪽 슬라이드 아웃 / 태블릿 닫기: 페이드 아웃
- **발신자 아바타:** `lib/notifications.ts`에서 알림 제목의 "님이" 앞 이름으로 프로필 조회 → `icon_image` 실시간 표시
- **gallery_like 알림 링크:** `&t=${Date.now()}` 타임스탬프 추가 — 이미 같은 URL에 있어도 강제 재이동
- `notifications` 테이블에 `sender_icon text` 컬럼 존재 (현재 미사용, 실시간 조회 방식 사용 중)

## 사용자 프로필 페이지

갤러리 좋아요 시트에서 다른 유저 아이디 클릭 시 진입하는 공개 프로필 페이지.

- **`/usercolor/[profileId]`** — 비로그인도 접근 가능한 공개 프로필 (아바타 + 가입일 표시)
- **`/account/userpage`** — 로그인 필수, 본인 아이디 등록 필수. `profileId` 쿼리로 대상 사용자 표시
- **`components/username-required-gate.tsx`** — 아이디 미등록 사용자 접근 시 confirm → `/account/general` 리다이렉트
- 두 페이지 모두 `category`, `index`, `likesSheet` 쿼리를 유지해 "돌아가기" 버튼으로 갤러리 좋아요 시트 복원

## Community (커뮤니티) 시스템

- **`/user_review`** — 리스트 페이지 (`components/main-user-review-page.tsx`)
- **`/user_content/[id]`** — 본문 페이지 (서버: auth만 → 클라이언트: `components/user-content-page.tsx`)
- **`/write_review`** — 글 작성 페이지
- **API:** `/api/main/user-review`, `/api/main/user-review/[id]`, `/api/main/user-review/[id]/likes`, `/api/main/user-review/[id]/comments`
- **DB 테이블:** `user_reviews` (thumbnail_image: JSON 배열), `review_likes`, `review_replies`

### Prefetch & Cache 아키텍처

로그인/비로그인 무관하게 헤더 마운트 시 동시 prefetch:
```
갤러리 공용 캐시(likes→comments) ┐ 동시 시작
커뮤니티 리스트 캐시              ┘
```

- **갤러리:** `getCached/setCached` (메모리 캐시, `hooks/use-prefetch-cache.ts`)
  - 공용 키: `gallery_public_${category}_${index}` (liked 제외, 로그인 무관)
  - 사용자별 키: `gallery_card_${category}_${index}_${userId}` (liked 포함)
- **커뮤니티:** `sessionStorage` (5분 TTL)
  - 리스트: `user-review-list-cache`
  - 본문: `user-review-content-${id}`
  - 좋아요: `user-review-likes-${id}`
  - 댓글: `user-review-comments-${id}`
- **핵심 패턴:** 캐시를 `useState` 초기값에서 **동기적으로** 읽어야 즉시 표시됨. `useEffect`에서 읽으면 한 사이클 딜레이 발생
  ```typescript
  // ✓ 올바른 패턴 — 첫 렌더링부터 데이터 표시
  const [item, setItem] = useState(() => getCache(id));
  // ✗ 잘못된 패턴 — 빈 화면 후 두 번째 렌더에서 표시
  const [item, setItem] = useState(null);
  useEffect(() => { setItem(getCache(id)); }, []);
  ```
- 리스트 진입 시 상위 10개 본문+좋아요+댓글 `router.prefetch()` + API 캐시 → 스크롤 하단 시 나머지 10개

### 중요: profiles.id = Clerk userId

`profiles.id`는 Clerk 사용자 ID(UUID)와 동일. `isAuthor` 체크 시 `currentUser()` + `syncProfile()` 불필요:
```typescript
const { userId } = await auth();
const isAuthor = !!userId && userId === item.profileId; // 직접 비교
```

### 비블로킹 패턴: after()

응답 후 실행할 작업(조회수 증가 등)은 Next.js `after()`를 사용:
```typescript
import { after } from "next/server";
after(() => { void incrementUserReviewViewCount(id); }); // 렌더링 블로킹 없음
```

### DB RPC 함수

Supabase에 등록된 RPC 함수:
- `increment_review_likes` / `decrement_review_likes` — 리뷰 좋아요
- `increment_user_review_view_count` — 커뮤니티 조회수 (단일 쿼리)

## Account Footer Nav

4개 고정: **사용자(/account/general)** → **상담내역** → **주문내역** → **내프로파일**
`components/account-nav-links.tsx` — lucide-react 아이콘 (User, MessageSquare, ShoppingBag, Sun)

## Project Structure

```
app/              # Next.js App Router
├── api/          # API routes
├── admin/        # Admin pages
├── account/      # User pages
└── ...           # Public pages

components/       # React components
lib/              # Utilities (supabase, consulting, profiles)
hooks/            # React hooks (notification Realtime, prefetch cache 등)
app/globals.css   # Global styles (500+ lines)
```

## Database Overview

**Core Tables:**
- `profiles` — User accounts (Clerk sync, includes `icon_image` bytea, `role`, `created_at`)
- `inquiries` — Consultations (type, status, content)
- `inquiry_replies` — Admin responses
- `landing_contents` — Editable content
- `orders` — User orders (user_id, status, total_amount)
- `payments` — Order payments (order_id, provider, amount)
- `products` — Product catalog
- `product_options` — Product variants (soft/bw/std)

**Notification System Tables:**
- `notifications` — Aggregated alerts (orders, reviews, gallery, etc) — consulting 타입 제외 (inquiries 쿼리로 처리)
- `reviews` — User reviews with categories
- `review_likes` — Review likes tracking
- `review_replies` — Replies to reviews
- `gallery_comments` — Comments on gallery items (author_icon_image, author_email 포함)
- `gallery_comment_likes` — Likes on gallery comments
- `gallery_item_likes` — Likes on gallery images

**Inquiry Status:** `pending` (red) → `in_progress` → `resolved` (blue) → `closed`

**Order Status:** `결제완료` (blue) → `환불진행중` (yellow) → `환불완료` (purple) → `결제오류` (red)

**Notification Types:** `settings` | `order_shipped` | `order_cancelled` | `consulting` | `review_reply` | `gallery_like`

**See DATABASE_SCHEMA.md** for complete database structure.

## Styling & Layout

- **Approach:** CSS-first with custom styles split into domain files (총 ~3800줄)
- **Mobile-first:** Baseline design targets mobile phones
- **Widths:** Mobile `480px`, Tablet `820px` (`--tablet-width`), media query at `1024px`
- **No desktop layout:** Desktop uses same responsive design as tablet
- **Consultation badges:** `.consulting-status-*` classes with color codes (red=pending, blue=resolved, gray=closed)
- **Layout reference:** See **LAYOUT_MAP.md** for zone name → CSS class → file mapping

### CSS 파일 구조

| 파일 | 내용 | 줄수 |
|------|------|------|
| `app/globals.css` | 변수, 리셋, 전역 유틸 (`.page`, `.section`, `.stack`, `.muted`) | ~73 |
| `app/styles/header.css` | 헤더, 심플헤더, 네비, 프로필아이콘, 배지, 햄버거팝업 | ~430 |
| `app/styles/landing.css` | 랜딩페이지, 히어로, 비교, 리뷰, 비디오, 푸터, 프라이싱 | ~525 |
| `app/styles/gallery.css` | 갤러리 섹션, 이미지, 인터랙션바, 댓글시트 | ~429 |
| `app/styles/admin.css` | 어드민 레이아웃/사이드바/패널/폼/메뉴 | ~582 |
| `app/styles/account.css` | 계정 페이지, 설정폼, 하단탭, 아이콘, 아바타 | ~1054 |
| `app/styles/consulting.css` | 상담내역 (사용자 + 관리자) | ~920 |
| `app/styles/notification.css` | 알림 드로어 | ~260 |
| `app/styles/user-review.css` | 커뮤니티 리스트/본문/작성 | — |

모두 `app/layout.tsx`에서 순서대로 임포트됨.

## Documentation

| File | Contains |
|------|----------|
| **claude.md** | This overview |
| **frontend.md** | Components, styling, client patterns |
| **backend.md** | APIs, database, server patterns |
| **share.md** | Routing, auth, workflows, deployment, preferences |
| **DATABASE_SCHEMA.md** | Complete database structure (all tables) |
| **WORK_SUMMARY_20260327.md** | Order system implementation summary |
| **README.md** | Full project details |
| **PLAN_1_DEV_STRATEGY.md** | RN 전환 전략, Optimistic UI, Realtime 계획 |
| **START_CHECKLIST.md** | Completed/pending tasks |

## Before You Start

1. **Setup:** Copy `.env.example` to `.env.local` and fill in Supabase/Clerk credentials
2. **Documentation:** Read **share.md** for auth/preferences, then **frontend.md** or **backend.md** based on task
3. **Development:** Run `npm run dev` (starts on localhost:3000 or 3001)
4. **Verify:** Test locally before committing

## Commit Convention

- **Commit message pattern:** When user says "XXX로 올려", use "XXX" as the commit message verbatim
- **Permission required:** NEVER commit or push without explicit user instruction. Always ask first. This is a strict rule.
- **Format:** `git commit -m "message" -m "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"`

## Pre-Push Checklist

Before committing/pushing changes:
1. **Build test:** `npm run build` (catches TypeScript/build errors)
2. **Lint check:** `npm run lint` (주의: 현재 Next.js 16 환경에서 `next lint`가 `.../lint` 디렉토리 오류로 실패할 수 있음)
  - 임시 운용: 빌드 통과(`npm run build`)를 최소 게이트로 사용하고, lint는 ESLint 설정 마이그레이션 후 복구
3. **Manual test:** Verify changes in dev server

## Language

User communicates in **Korean**. Respond in Korean when addressed in Korean. Grammar note: "~게" = user will do it, "~려" = command to assistant.

## Common Gotchas

| Issue | Solution |
|-------|----------|
| "Type is not assignable to Promise" | Next.js 16: must `await params` in dynamic routes |
| Cache corruption in dev | Delete `.next/` folder and restart `npm run dev` |
| Port 3000 in use | Dev server auto-uses 3001; check `package.json` scripts |
| RLS policy errors | Check Supabase Row-Level Security policies match auth checks |
| Notification table not found | Run DB migration: `alter table profiles add column if not exists icon_image bytea` |
| Avatar upload fails | Ensure `icon_image` bytea column exists on profiles table |
| Notification count mismatch | Items must be loaded on mount, not on drawer open (HeaderProfileLink.tsx) |
| Invalid date in join date | formatDate function handles null/invalid dates (returns "날짜 오류") |
| iOS input zoom | `font-size` must be ≥ 16px on `<input>` to prevent iOS Safari auto-zoom |
| `npm run lint` fails with `.../lint` directory error | Next.js 16에서 `next lint` 인식 이슈. 현재 저장소는 `eslint.config.*` 미구성이라 ESLint CLI도 즉시 실행 불가 → 우선 `npm run build`로 검증하고, 추후 lint 체계를 ESLint Flat Config로 마이그레이션 |
| Dev 서버 중복 실행으로 화면/오류가 섞여 보임 | `npm run dev`를 중복 실행하면 3000/3001로 분리되어 구버전/신버전이 혼재될 수 있음. 실행 전 `lsof -nP -iTCP:3000 -sTCP:LISTEN` 확인 후, 중복 프로세스 종료하고 서버 1개만 유지 |
| Hydration error after nav change | Delete `.next/` cache — stale server/client mismatch in client components |
| Consulting notification duplicate | `notifications` 테이블 조회 시 `.neq("type", "consulting")` 필수 — inquiries 쿼리에서 별도 처리 |
| Gallery like 하트 사라짐 | IntersectionObserver GET 응답이 클릭 후 도착해 상태 덮어씀 → `userInteractedRef`로 차단 (`gallery-card.tsx`) |
| 지난 알림 클릭 시 flash 미동작 | 같은 URL 재방문 시 Next.js 재렌더 안 함 → `gallery_like` 링크에 `&t=Date.now()` 추가 |
| 갤러리 알림 재클릭 시 댓글창 안 열림 | 이미 갤러리 페이지에 있으면 `autoOpenComments`가 `true→true`로 유지되어 effect 재실행 안 됨 → `openTimestamp` prop을 의존성에 추가해 `t` 값 변경으로 재실행 유도 |
