# CLAUDE.md

## 스킬 규칙 (최우선)
- `using-superpowers` 스킬 사용 금지

## 코드 검색 규칙 (최우선, 거짓말 방지)

검색 시 첫 번째 결과를 정답으로 단정하지 말 것.

1. 동일한 텍스트/기능을 가진 요소가 몇 개인지 **전체 검색 먼저 수행**
2. 모든 후보를 나열한 후 정확한 요소를 특정
3. CSS 클래스명 확인 시 해당 클래스가 실제로 적용된 요소까지 추적

**Why:** 동일 텍스트("프로필사진")가 여러 버튼에 존재할 수 있어, 첫 번째 검색 결과만 보고 단정하면 거짓말이 됨.

## 메모리 규칙 (최우선)

모든 답변 전에 `/Users/chalres/.claude/projects/-Users-chalres-Projects-test-codex/memory/MEMORY.md`의 메모리 규칙을 먼저 읽고 적용할 것. 사용자가 별도로 언급하지 않아도 항상 적용.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. See **frontend.md**, **backend.md**, and **share.md** for detailed specifications.
Also follow **AGENTS.md** for shared agent workflow and verification rules.

## Quick Start

```bash
npm install                    # Install dependencies
cp .env.example .env.local     # Copy environment template
npm run dev                    # Start dev server (localhost:3000)
npm run build                  # Build for production
npm run start                  # Start production server
```

## 토큰 사용량 규칙 (최우선)


**Why:** 작업 중간에 토큰 한도 초과로 중단되는 것을 방지하기 위한 사용자 규칙.

**How to apply:** 작업 전 토큰 여유 확인. 90% 이상이거나 작업량 대비 토큰이 부족할 것 같으면 시작하지 말 것. /compact 언급 금지.

> **레이아웃 수정 요청 시 반드시 아래 순서를 따를 것 (생략 금지):**
> 1. **LAYOUT_MAP.md** 를 먼저 참조하여 해당 구역의 파일과 클래스를 확인
> 2. **부모 요소부터 자식 요소까지 전체 구조를 파악**하고 이미 적용된 스타일 확인
> 3. 확인한 내용을 사용자에게 먼저 보고한 후 수정 진행


## Project Overview

**Arao** — Next.js 15.5.15 (App Router) + TypeScript + Clerk + Supabase (PostgreSQL + Realtime + Storage) + Vercel 배포

Import alias: `@/` → project root

## Authentication & Protected Routes

- Clerk 로그인 → `syncProfile()`로 Supabase profiles 자동 생성
- **보호 경로:** `/admin/*` (role=admin), `/account/*` (인증), `/article/*` (admin), 나머지 공개

## Critical: Next.js 15.5.15 Dynamic Routes

`params`는 반드시 `await` 필요. TypeScript가 잡지 못함:
```typescript
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;  // Must await!
}
```


## Styling & Layout

- **CSS-first:** 도메인별 파일 분리 (`app/styles/`), `app/layout.tsx`에서 순서대로 임포트
- **Mobile-first:** 기본값(쿼리 없음)이 모바일, `@media (min-width: 820px)` 단일 분기로 태블릿+데스크탑 공통 적용
- **브레이크포인트 단일:** `820px` 하나만 사용. 480/600/768/1024px 등 다른 값 추가 금지
- **컨테이너:** 태블릿+ 구간에서 `max-width: 820px`, `margin: 0 auto` 고정폭. 데스크탑도 동일
- **데스크톱 없음:** 1024px 이상도 820px 고정폭 안에서 표시, 별도 분기 없음
- **헤더/푸터/댓글시트:** 위 정책 동일하게 상속, 별도 분기점 사용 금지
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


## Commit Convention

- **"XXX로 올려"** → commit message를 "XXX" 그대로 사용
- **커밋/푸시는 사용자가 명시적으로 요청할 때만.** 절대 작업후 스스로 판단 하지 않는다.
- Format: 각 AI는 본인의 명칭과 이메일을 'Co-Authored-By' 필드에 작성하여 커밋할 것.

## Pre-Push Checklist

1. `npm run build` — 최소 게이트 (`npm run lint`는 현재 Next.js 15.5.15 환경에서 실패함)
2. Dev 서버에서 수동 확인 사용자에게 물어볼것.



## Language Rules (Core)

### 소통 원칙
- **톤앤매너**: 감정 배제, 짧고 간결한 전문가 어조, 이모지/은유 금지.
- **포맷**: 분석/정리는 무조건 **표(Table)** 사용.


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
