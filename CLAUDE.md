# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. See **frontend.md**, **backend.md**, and **share.md** for detailed specifications.

> **레이아웃 수정 요청 시** → **LAYOUT_MAP.md** 를 먼저 참조. 구역명(헤더, 히어로, 계정 > 하단탭 등)으로 파일과 클래스를 즉시 찾을 수 있음.

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
- Real-time notification badges (60s polling)

## Gallery Card UI (Instagram Style)

갤러리 페이지(`/gallery`)는 각 이미지를 `GalleryCard` 컴포넌트로 래핑합니다.

- **`components/gallery-card.tsx`** — 이미지 + 인터랙션 바 (하트/댓글/공유) + 좋아요 문구 + 설명
  - 하트: `likeCount >= 1` 이면 `#FF2D2D` (로고 빨간색) 채움
  - 좋아요 문구: `<strong>` 으로 아이디/N명 부분만 bold
- **`components/gallery-comment-sheet.tsx`** — 바텀 시트 댓글창
  - 높이 `50vh`, 드래그 다운 닫기, 외부 클릭 슬라이드 다운
  - 이모지 바 (40개), 이메일 마스킹 (`ch***@gmail.com`), 아바타 표시
  - input `font-size: 16px` 필수 (iOS 줌 방지)
- **`lib/gallery-interactions.ts`** — 좋아요/댓글 DB 로직 (admin 클라이언트, `GalleryComment` 타입 정의)
- **API:** `/api/gallery/[category]/[index]/likes`, `/api/gallery/[category]/[index]/comments`, `/api/gallery/comments/[id]/likes`
- **DB 테이블:** `gallery_item_likes`, `gallery_comments`, `gallery_comment_likes` (RLS 비활성화)
- **아이디 없는 사용자 댓글:** `profile_id`로 저장됨 — 아이디 없어도 DB에 정상 저장됨

## Headers

- **`components/landing-page-header.tsx`** — 공개 페이지용 (햄버거 + 캐릭터)
- **`components/simple-header.tsx`** (헤더2) — `/account/*` 전용, 로고만 가운데
- 계정 레이아웃(`app/account/layout.tsx`)은 `SimpleHeader` 사용

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

## Account Footer Nav

5개 고정: **홈(/)** → **사용자(/account/general)** → **상담내역** → **주문내역** → **내프로파일**
`components/account-nav-links.tsx`의 `userSections` + 하드코딩된 홈 링크

## Project Structure

```
app/              # Next.js App Router
├── api/          # API routes
├── admin/        # Admin pages
├── account/      # User pages
└── ...           # Public pages

components/       # React components
lib/              # Utilities (supabase, consulting, profiles)
hooks/            # React hooks (notification polling)
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
2. **Lint check:** `npm run lint`
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
| Hydration error after nav change | Delete `.next/` cache — stale server/client mismatch in client components |
| Consulting notification duplicate | `notifications` 테이블 조회 시 `.neq("type", "consulting")` 필수 — inquiries 쿼리에서 별도 처리 |
| Gallery like 하트 사라짐 | IntersectionObserver GET 응답이 클릭 후 도착해 상태 덮어씀 → `userInteractedRef`로 차단 (`gallery-card.tsx`) |
| 지난 알림 클릭 시 flash 미동작 | 같은 URL 재방문 시 Next.js 재렌더 안 함 → `gallery_like` 링크에 `&t=Date.now()` 추가 |
