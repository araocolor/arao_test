
# my memo


### 데이타베이스 연결 주의사항 

URL = General 설정에서
ANON_KEY = Publishable key (위쪽)
SERVICE_ROLE_KEY = Secret keys (아래쪽)

환경변수에 다음에 맞는 값입력

NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY



### 기타 

현재 상태는 이렇게 정리할 수 있습니다.

Next.js 프로젝트가 로컬에서 정상 실행됩니다.
Clerk 로그인 연결이 되어 있습니다.
Supabase 연결이 되어 있습니다.
profiles 테이블이 생성되어 있고, 로그인 계정 정보가 연결됩니다.
관리자 계정의 role을 admin으로 두면 /admin 접근이 가능합니다.
/admin에서 관리자 화면 카드 4개가 정상 표시됩니다.
/admin에 로그아웃 버튼을 추가했고, 로그아웃 후 다시 /sign-in으로 이동하는 흐름도 확인했습니다.
/api/health가 ok: true를 반환해서 서버 상태 확인도 정상입니다.
Vercel 배포까지 완료했습니다.
즉 한 줄 요약하면:
로그인 + 관리자 권한 + 로그아웃 + 배포까지 되는 기본 운영 뼈대가 완성된 상태입니다.

다음 단계 후보는 보통 이 둘입니다.

products / orders 기능 확장
GitHub 정리 및 배포 운영 정리


## 프로젝트 개발 방향

### 타겟 디바이스
- **모바일** (아이폰): 주요 타겟. 세로/가로 모두 모바일 레이아웃 유지
- **아이패드** (태블릿): 넓은 레이아웃의 기준 디바이스. 이것이 최대 레이아웃

### 브레이크포인트 기준
- `max-width: 1024px` → 모바일 레이아웃 (아이폰 가로 포함)
- `min-width: 1024px` → 아이패드 기준 레이아웃

### 레이아웃 원칙
- 레이아웃은 모바일 / 아이패드 두 가지만 존재
- 데스크탑 브라우저에서도 아이패드 레이아웃 그대로 표시 (별도 확장 없음)
- 전체 컴포넌트 최대 너비는 아이패드 화면 기준으로 고정

---

## 로컬에서 페이지 수정하는방법

clerk 에서 localhost 명칭을 허락안해줌
아이피주소도 허락 안해줘서
ngrok.com 에서 접속해서 무료 가입후 authtoken 을 갖고 와야 함
임시 http: 주소를 부여받아 우회하면서 테스트 하는 방법

---

## README 아카이브 (2026-03-27)

### 배포
- **Production:** https://arao-test-7gxt.vercel.app
- **GitHub:** https://github.com/araocolor/arao_test
- **플랫폼:** Vercel (GitHub 연동 자동 배포)

### 기술 스택
| 역할 | 기술 |
|------|------|
| 프레임워크 | Next.js (App Router) |
| 인증 | Clerk |
| 데이터베이스 | Supabase (PostgreSQL) |
| 파일 저장 | Supabase Storage |
| 국내 결제 | PortOne (스텁 상태) |
| 글로벌 결제 | Stripe (스텁 상태) |
| 배포 | Vercel |

### 페이지 구조
**랜딩:** `/` (홈), `/arao` (소개), `/gallery` (갤러리), `/pricing` (가격), `/manual` (가이드)
**인증:** `/sign-in`, `/sign-up`
**사용자:** `/account` (프로필), `/account/withdraw` (탈퇴-미연결)
**관리자:** `/admin` (대시보드), `/article` (상담목록)

### Supabase 테이블
```
profiles, products, orders, order_items, payments, landing_contents, inquiries, inquiry_replies
```

### API Routes
- `/api/health` - 서버 상태
- `/api/admin/landing-content` - 랜딩 콘텐츠
- `/api/account/*` - 사용자 API
- `/api/admin/consulting/*` - 관리자 상담 API

### 환경변수
```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY
(Optional: PORTONE_*, STRIPE_*)
```

### 현재 미연결 항목
- PortOne 실결제
- Stripe 실결제
- 주문/매출 관리 UI
- 회원탈퇴 처리 로직

---

## 향후 작업 (TO-DO)

### 우선순위 높음
- [ ] `landing_contents` 테이블 SQL 최종 확인
- [ ] Supabase Storage public URL 최종 점검
- [ ] `schema.sql` 중복 컬럼 정리

### 결제 연결
- [ ] PortOne 테스트 결제 연결
- [ ] Stripe 테스트 결제 연결
- [ ] 국가/통화 기준 분기 규칙 (KRW → PortOne, USD → Stripe)
- [ ] 결제 완료 후 주문 상태 업데이트
- [ ] 결제 실패/취소 처리
- [ ] 환불 처리 흐름

### 관리자 페이지 확장
- [ ] 회원 관리 UI (Clerk 조회, role 변경)
- [ ] 주문 관리 UI (목록, 상태 변경)
- [ ] 매출 관리 UI (집계, 리포트)
- [ ] 인증 관리 UI

### 사용자 기능
- [ ] 회원탈퇴 실제 로직
- [ ] 주문내역 페이지
- [ ] 상담내역 페이지 (✅ 기본 완료)
- [ ] 후기 작성/관리

### 운영 준비
- [ ] 운영용 Clerk 키로 전환 (현재 test)
- [ ] 에러 페이지 전략 (not-found, error.tsx)
- [ ] 로그 수집 방식
- [ ] 주문 상태값 정의 (pending/paid/cancelled/refunded)

### 주요 파일 위치
| 파일 | 역할 |
|------|------|
| `lib/consulting.ts` | 상담/문의 조회/저장 |
| `lib/landing-content.ts` | 랜딩 콘텐츠 |
| `lib/profiles.ts` | Clerk-Supabase 동기화 |
| `components/admin-dashboard.tsx` | 관리자 대시보드 |
| `components/consulting-section.tsx` | 사용자 상담 |
| `components/admin-consulting-manager.tsx` | 관리자 상담관리 |
