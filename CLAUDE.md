# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. See **frontend.md**, **backend.md**, and **share.md** for detailed specifications.
Also follow **AGENTS.md** for shared agent workflow and verification rules.

> **레이아웃 수정 요청 시 반드시 아래 순서를 따를 것 (생략 금지):**
> 1. **LAYOUT_MAP.md** 를 먼저 참조하여 해당 구역의 파일과 클래스를 확인
> 2. **부모 요소부터 자식 요소까지 전체 구조를 파악**하고 이미 적용된 스타일 확인
> 3. 확인한 내용을 사용자에게 먼저 보고한 후 수정 진행


## Quick Start

```bash
npm install                    # Install dependencies
cp .env.example .env.local     # Copy environment template
npm run dev                    # Start dev server (localhost:3000)
npm run build                  # Build for production
npm run start                  # Start production server
```

## Project Overview

**Arao** — Next.js 16 (App Router) + TypeScript + Clerk + Supabase (PostgreSQL + Realtime + Storage) + Vercel 배포

Import alias: `@/` → project root

## Authentication & Protected Routes

- Clerk 로그인 → `syncProfile()`로 Supabase profiles 자동 생성
- **보호 경로:** `/admin/*` (role=admin), `/account/*` (인증), `/article/*` (admin), 나머지 공개

## Critical: Next.js 16 Dynamic Routes

`params`는 반드시 `await` 필요. TypeScript가 잡지 못함:
```typescript
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;  // Must await!
}
```

## 핵심 패턴

### 캐시 로딩

```typescript
// O — useEffect에서 로드
const [item, setItem] = useState(null);
useEffect(() => {
  const cached = getCache(id);
  if (cached) setItem(cached);
}, [id]);

// X — useState 초기값에서 로드 (Hydration 에러)
const [item, setItem] = useState(() => getCache(id));
```

### 뒤에서 처리: after()

```typescript
import { after } from "next/server";
after(() => { void incrementUserReviewViewCount(id); });
```

상세 내용은 **frontend.md**, **backend.md** 참조.

## Styling & Layout

- **CSS-first:** 도메인별 파일 분리 (`app/styles/`), `app/layout.tsx`에서 순서대로 임포트
- **Mobile-first:** 모바일 480px, 태블릿 `--tablet-width` 820px, 미디어 쿼리 1024px
- **데스크톱 없음:** 태블릿과 동일한 반응형
- **Layout reference:** See **LAYOUT_MAP.md**

## Documentation

| File | Contains |
|------|----------|
| **frontend.md** | Components, styling, client patterns |
| **backend.md** | APIs, database, server patterns |
| **share.md** | Routing, auth, workflows, deployment, preferences |
| **DATABASE_SCHEMA.md** | Complete database structure |
| **LAYOUT_MAP.md** | 구역명 → CSS 클래스 → 파일 매핑 |
| **CACHE_IMPROVEMENTS.md** | 캐싱 전략 개선 계획 (심각도별 체크리스트) |

> **캐싱 개선 작업 규칙**: 사용자가 "개선사항 보여줘" 또는 "캐시 개선" 을 요청할 때만 **CACHE_IMPROVEMENTS.md**를 참조하여 미완료 항목을 확인하고 보고할 것. 자동으로 개선 작업을 시작하지 말 것.

## Commit Convention

- **"XXX로 올려"** → commit message를 "XXX" 그대로 사용
- **커밋/푸시는 사용자가 명시적으로 요청할 때만.** 절대 먼저 하지 않는다.
- Format: 각 AI는 본인의 명칭과 이메일을 'Co-Authored-By' 필드에 작성하여 커밋할 것.

## Pre-Push Checklist

1. `npm run build` — 최소 게이트 (`npm run lint`는 현재 Next.js 16 환경에서 실패함)
2. Dev 서버에서 수동 확인 사용자에게 물어볼것.



## Language Rules (Core)

### 1. 종결 어미 규약
- **~게**: 사용자가 할 일 (선언)
- **~하세요**: 어시스턴트 지시 (명령)
- **~함 / ~임**: 작업 완료 보고 및 팩트 전달 (요약)
- **~나?**: 코드 리뷰 및 수정 제안

### 2. 소통 원칙
- **톤앤매너**: 감정 배제, 짧고 간결한 전문가 어조, 이모지/은유 금지.
- **포맷**: 분석/정리는 무조건 **표(Table)** 사용.
- **단위**: 거리 `cm`, 가격 `원` 환산 필수.
- **긴급**: 치명적 오류 시 **🚨** 접두어 사용.

## Common Gotchas

| Issue | Solution |
|-------|----------|
| "Type not assignable to Promise" | `await params` in dynamic routes |
| Cache corruption in dev | `.next/` 삭제 후 재시작 |
| Dev 서버 중복 실행 | `lsof -nP -iTCP:3000 -sTCP:LISTEN` 확인, 1개만 유지 |
| Hydration error | `.next/` 삭제 — SSR/클라이언트 불일치 |
| iOS input zoom | `<input>` font-size >= 16px 필수 |
| Gallery 좋아요 하트 사라짐 | IntersectionObserver 응답이 클릭 후 덮어씀 → `userInteractedRef` 차단 |
| 알림 재클릭 미동작 | 링크에 `&t=${Date.now()}` 추가해 강제 재이동 |
| 갤러리 댓글창 재오픈 안 됨 | `openTimestamp` prop 의존성에 추가해 `t` 변경으로 재실행 |
| RLS policy errors | Supabase Row-Level Security 정책 확인 |
