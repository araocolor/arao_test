# 개발 준비서 — Plan 1

> 작성일: 2026-03-30
> 목적: 웹 완성 후 React Native 전환을 전제로 한 개발 전략 + 네이티브급 사용자 경험 구현

---

## 1. 배경 및 목표

| 항목 | 내용 |
|------|------|
| 현재 | Next.js 16 웹 서비스 (arao-test-7gxt.vercel.app) |
| 단기 목표 | 웹 기능 완성 |
| 중기 목표 | 웹 완성 후 약 3개월 시점에 React Native 앱 개발 착수 |
| 핵심 방향 | 웹/앱 코드 최대 재사용 + 네이티브 앱 수준의 사용감 |

---

## 2. React Native 전환 준비 전략

### 2-1. 지금 잘 되어 있는 것 (유지)

- `lib/` 폴더 비즈니스 로직 분리 (notifications, consulting, gallery-interactions 등)
- API 라우트 분리 (`/api/*`)
- Supabase 연동 구조 (`@supabase/supabase-js`는 RN 지원)

### 2-2. 지금부터 준비해야 할 것

#### ① 디자인 토큰 JS 상수화
CSS 변수는 RN에서 사용 불가. JS 상수 파일을 병행 관리하면 웹/앱 공통 사용 가능.

```ts
// lib/tokens.ts (신규 생성)
export const colors = {
  brand:   "#FF2D2D",
  text:    "#111111",
  muted:   "#6e6e73",
  surface: "#ffffff",
  bg:      "#f5f5f7",
  line:    "rgba(17,17,17,0.08)",
  yellow:  "#FCD34D",
}

export const radius = {
  card:   20,
  button: 999,
  sheet:  20,
}

export const spacing = {
  page:    16,
  section: 24,
  gap:     16,
}
```

#### ② 인증 로직 훅으로 분리
Clerk 웹 SDK는 RN 미지원 → `@clerk/clerk-expo`로 교체 예정.
지금부터 인증 로직을 컴포넌트 내부에 직접 쓰지 않고 훅으로 분리.

```ts
// hooks/useAuth.ts (신규 생성)
// 웹: useUser() from @clerk/nextjs 래핑
// 앱 전환 시: @clerk/clerk-expo로 내부만 교체
```

#### ③ API 호출 커스텀 훅 패턴 유지
fetch 직접 호출보다 커스텀 훅으로 래핑 → 앱 전환 시 내부 구현만 교체 가능.

```ts
// hooks/useNotifications.ts (기존 패턴 유지)
// hooks/useConsulting.ts
// hooks/useOrders.ts
```

### 2-3. 전환 시 재작성이 필요한 영역 (미리 알고 있기)

| 영역 | 이유 | 난이도 |
|------|------|------|
| UI 전체 (CSS → StyleSheet) | RN CSS 미지원 | 높음 |
| Next.js App Router 구조 | RN에서 무의미 | 높음 |
| 이미지 컴포넌트 | Next.js Image → RN Image | 낮음 |
| 폰트 | CSS font-family → Expo Google Fonts | 낮음 |
| Supabase Admin Client | 서버 전용 → 클라이언트 전용 재작성 | 보통 |
| Clerk 인증 | @clerk/nextjs → @clerk/clerk-expo | 보통 |
| 갤러리/댓글 인터랙션 | 터치 이벤트 방식 차이 | 높음 |

---

## 3. 네이티브급 사용자 경험 구현

### 3-1. 현재 상태

| 기술 | 현재 | 수준 |
|------|------|------|
| Prefetch | Link prefetch={true} | ✅ 적용됨 |
| Optimistic UI | 갤러리 좋아요만 | 🔶 부분 적용 |
| Realtime Sync | 알림 60초 폴링 | 🔶 기초 수준 |

### 3-2. Optimistic UI 확대 적용

서버 응답을 기다리지 않고 UI를 먼저 바꾸고, 실패 시 되돌리는 패턴.

**적용 대상 (우선순위 순)**

| 기능 | 현재 | 변경 후 |
|------|------|------|
| 갤러리 좋아요 | ✅ 이미 적용 | 유지 |
| 갤러리 댓글 등록 | 서버 응답 후 표시 | 즉시 목록 추가 |
| 상담 글 작성 | 서버 응답 후 이동 | 즉시 목록에 표시 |
| 알림 읽음 처리 | 서버 응답 후 반영 | 즉시 배지 제거 |

**구현 패턴**
```ts
// 예시: 댓글 등록 Optimistic UI
const [comments, setComments] = useState(initialComments)

async function addComment(text: string) {
  const temp = { id: "temp-" + Date.now(), content: text, ... }
  setComments(prev => [...prev, temp])          // 즉시 UI 반영

  const result = await postComment(text)
  if (result.error) {
    setComments(prev => prev.filter(c => c.id !== temp.id))  // 실패 시 롤백
  } else {
    setComments(prev => prev.map(c => c.id === temp.id ? result.data : c))
  }
}
```

### 3-3. Realtime Sync (Supabase Realtime)

60초 폴링을 WebSocket 실시간 연결로 교체.

**적용 대상 (단계별)**

**1단계 — 알림 실시간화 (가장 효과 큼)**
```ts
// hooks/useNotifications.ts 수정
// 현재: 60초 setInterval polling
// 변경: Supabase Realtime channel 구독

supabase
  .channel("notifications")
  .on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "notifications",
    filter: `profile_id=eq.${profileId}`
  }, (payload) => {
    // 새 알림 즉시 반영, 배지 카운트 업데이트
  })
  .subscribe()
```

**2단계 — 상담 답변 실시간화**
- 관리자가 답변 등록 → 사용자 화면에 즉시 알림 + 상태 변경

**3단계 — 주문 상태 실시간화**
- 주문 상태 변경 시 즉시 반영

---

## 4. 실행 계획 (우선순위)

### Phase 1 — 지금 바로 (웹 개발 병행)
| 작업 | 예상 시간 | 효과 |
|------|---------|------|
| `lib/tokens.ts` 디자인 토큰 생성 | 30분 | RN 전환 준비 |
| `hooks/useAuth.ts` 인증 훅 분리 | 1시간 | RN 전환 준비 |
| Optimistic UI — 댓글/알림 읽음 | 2시간 | 사용감 향상 |

### Phase 2 — 웹 기능 완성 후
| 작업 | 예상 시간 | 효과 |
|------|---------|------|
| Supabase Realtime 알림 교체 | 3시간 | 실시간 알림 |
| Optimistic UI — 상담 글 작성 | 2시간 | 사용감 향상 |
| Supabase Realtime 상담 답변 | 2시간 | 실시간 상담 |

### Phase 3 — React Native 착수 시점
| 작업 | 비고 |
|------|------|
| Expo 프로젝트 초기 설정 | |
| `lib/`, `hooks/` 재사용 | 웹에서 그대로 이식 |
| `lib/tokens.ts` 공유 | 동일 파일 사용 |
| UI 레이어 전면 재작성 | NativeWind 권장 |
| Clerk Expo 인증 교체 | hooks/useAuth.ts 내부만 수정 |

---

## 5. 기술 스택 변화 예고

| 항목 | 웹 (현재) | 앱 (예정) |
|------|---------|---------|
| Framework | Next.js 16 | Expo (React Native) |
| Auth | @clerk/nextjs | @clerk/clerk-expo |
| DB | Supabase (서버/클라이언트) | Supabase (클라이언트 전용) |
| 스타일 | CSS (styles/*.css) | NativeWind 또는 StyleSheet |
| 라우팅 | Next.js App Router | Expo Router |
| 이미지 | next/image | expo-image |
| 알림 | Supabase Realtime (웹푸시) | Expo Notifications |
| 상태관리 | useState + 커스텀 훅 | 동일 유지 가능 |

---

## 6. 요약

> 지금 해두면 3개월 후 앱 개발 속도가 크게 빨라지는 작업은 딱 두 가지입니다.
>
> 1. **`lib/tokens.ts`** — 디자인 토큰 JS 상수화 (30분)
> 2. **`hooks/useAuth.ts`** — 인증 로직 훅 분리 (1시간)
>
> 나머지는 웹 완성 후 자연스럽게 진행하면 됩니다.
