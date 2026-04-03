# test_codex — Copilot Workspace Instructions

> Full specs: **CLAUDE.md** (overview) · **frontend.md** · **backend.md** · **share.md**  
> Layout zones: **LAYOUT_MAP.md** — 구역명 → CSS 클래스 → 파일 즉시 매핑  
> DB schema: **DATABASE_SCHEMA.md**  
> Legacy sample docs: **test3/README.md**

## Stack

- **Next.js 16** (App Router) · **TypeScript** · **Clerk** auth · **Supabase** (Postgres + Realtime + Storage)
- Deploy: Vercel (auto on `git push origin main`)
- Import alias: `@/` → project root

## Build & Dev

```bash
npm run dev      # localhost:3000 (3001 if 3000 occupied)
npm run build    # Production build — run before every push
npm run start    # Production server
```

> `npm run lint` 현재 실패함 (Next 16 + eslint.config 미구성). **`npm run build` 통과를 최소 게이트로 사용**.

## Commit Rules — STRICT

- **커밋/푸시는 사용자가 명시적으로 요청할 때만 실행**. 절대 먼저 하지 않는다.
- Format: `git commit -m "메시지" -m "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"`
- "XXX로 올려" → commit message를 "XXX" 그대로 사용.
- **dev 서버 실행 전**: `lsof -nP -iTCP:3000 -sTCP:LISTEN` 으로 중복 여부 먼저 확인. 중복 프로세스가 있으면 종료 후 1개만 유지.

## Critical: Next.js 16 Dynamic Routes

`params`는 반드시 `await` 필요. TypeScript가 잡지 못함:

```typescript
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // ← 필수
}
```

## Architecture at a Glance

| Layer | Pattern |
|-------|---------|
| Server Components | Data fetch, auth check, admin ops |
| Client Components | Interactive UI (`"use client"`) |
| API Routes (`app/api/`) | Client → auth → Supabase bridge |
| CSS | Domain-split files in `app/styles/` — see **LAYOUT_MAP.md** |

Protected routes: `/admin/*` (role=admin), `/account/*` (auth), `/article/*` (admin)  
Public: everything else.

## Top Gotchas

| Issue | Fix |
|-------|-----|
| "Type not assignable to Promise" | `await params` in dynamic routes |
| 화면이 구버전/에러 섞여 보임 | dev 서버 중복 실행 — 기존 프로세스 종료 후 재시작 |
| Hydration error | `.next/` 삭제 후 `npm run dev` |
| iOS 입력창 화면 확대 | `<input>` font-size ≥ 16px 필수 |
| Gallery 좋아요 하트 사라짐 | IntersectionObserver 응답이 클릭 후 도착해 덮어씀 → `userInteractedRef` 차단 |
| Consulting 알림 중복 | `notifications` 쿼리에 `.neq("type","consulting")` 필수 |
| 알림 재클릭 미동작 | 링크에 `&t=${Date.now()}` 추가해 강제 재이동 |
| RLS 에러 | Supabase Row-Level Security 정책 확인 |

## Language

사용자는 **한국어**로 소통합니다. 한국어로 질문하면 한국어로 답변하세요.
