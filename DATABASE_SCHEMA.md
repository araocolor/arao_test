# 데이터베이스 구조 (Database Schema)

Arao 프로젝트의 전체 데이터베이스 구조. Supabase (PostgreSQL)에서 관리.

---

## 📋 테이블 목록

| 테이블 | 설명 | 상태 |
|--------|------|------|
| **profiles** | 사용자 계정 (Clerk 동기화) | ✅ 활성 |
| **inquiries** | 1:1 상담/문의 | ✅ 활성 |
| **inquiry_replies** | 상담 답변 | ✅ 활성 |
| **landing_contents** | 랜딩 페이지 콘텐츠 | ✅ 활성 |
| **products** | 상품 정보 | ✅ 활성 |
| **product_options** | 상품 옵션 (soft/bw/std) | ✅ 활성 |
| **orders** | 주문 | ✅ 활성 |
| **payments** | 결제 정보 | ✅ 활성 |
| **order_items** | 주문 라인 아이템 | 📅 계획 중 |
| **colors** | 컬러 레시피 피드 | 📅 신규 생성 필요 |

---

## 🎨 colors (컬러 레시피 피드)

**설명:** 컬러 레시피 등록 및 피드 표시용 테이블

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | uuid | PK DEFAULT gen_random_uuid() | 고유 ID |
| profile_id | uuid | FK→profiles | 작성자 |
| is_admin | boolean | DEFAULT false | 관리자 작성 여부 |
| title | text | NOT NULL | 제목 |
| content | text | - | 내용 |
| price | integer | - | 가격 (원) |
| file_link | text | - | 외부 파일 링크 |
| img_standard_full | text | - | standard 이미지 full(1024) |
| img_standard_mid | text | - | standard 이미지 mid(480) |
| img_standard_thumb | text | - | standard 이미지 thumb(200) |
| img_portrait_full | text | - | portrait 이미지 full(1024) |
| img_portrait_mid | text | - | portrait 이미지 mid(480) |
| img_portrait_thumb | text | - | portrait 이미지 thumb(200) |
| img_arao_full | text | - | arao 이미지 full(1024) |
| img_arao_mid | text | - | arao 이미지 mid(480) |
| img_arao_thumb | text | - | arao 이미지 thumb(200) |
| like_count | integer | DEFAULT 0 | 좋아요 수 |
| created_at | timestamp | DEFAULT NOW() | 생성 시각 |

**Supabase 생성 SQL:**
```sql
create table colors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  is_admin boolean not null default false,
  title text not null,
  content text,
  price integer,
  file_link text,
  img_standard_full text,
  img_standard_mid text,
  img_standard_thumb text,
  img_portrait_full text,
  img_portrait_mid text,
  img_portrait_thumb text,
  img_arao_full text,
  img_arao_mid text,
  img_arao_thumb text,
  like_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index on colors (created_at desc);
create index on colors (profile_id);
```

---

## 👤 1. profiles (사용자 계정)

**설명:** 로그인 사용자 이메일 기준으로 동기화되는 사용자 계정 정보

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | uuid | PK | 내부 사용자 고유 ID (코드에서 randomUUID()로 생성) |
| email | text | UNIQUE | 이메일 주소 |
| username | text | - | 사용자명 (아이디) |
| full_name | text | - | 전체 이름 |
| phone | text | - | 전화번호 |
| role | text | DEFAULT 'user' | 'user' \| 'admin' |
| password_hash | text | - | 비밀번호 해시 |
| created_at | timestamp | DEFAULT NOW() | 계정 생성 시각 |

**인덱스:**
- email (UNIQUE)
- id (PK)

**사용처:**
- 인증 정보 저장
- 역할 기반 접근 제어 (RBAC)

---

## 💬 2. inquiries (1:1 상담/문의)

**설명:** 사용자가 제출한 상담 요청 또는 일반 문의

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | uuid | PK | 상담 고유 ID |
| profile_id | uuid | FK→profiles | 상담자 |
| type | text | DEFAULT 'consulting' | 'consulting' \| 'general' |
| title | text | NOT NULL | 제목 |
| content | text | NOT NULL | 본문 |
| status | text | DEFAULT 'pending' | pending \| in_progress \| resolved \| closed |
| has_unread_reply | boolean | DEFAULT false | 읽지 않은 답변 있음 |
| created_at | timestamp | DEFAULT NOW() | 생성 시각 |
| updated_at | timestamp | DEFAULT NOW() | 수정 시각 |

**인덱스:**
- profile_id
- status

**상태 흐름:**
```
pending (빨강, 대기중)
  ↓
in_progress (파랑, 진행중)
  ↓
resolved (파랑, 완료)
  ↓
closed (회색, 종료)
```

---

## 💬 3. inquiry_replies (상담 답변)

**설명:** 관리자가 작성한 상담 답변

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | uuid | PK | 답변 고유 ID |
| inquiry_id | uuid | FK→inquiries | 상담 ID |
| author_id | uuid | FK→profiles | 작성자 (관리자) |
| content | text | NOT NULL | 답변 내용 |
| created_at | timestamp | DEFAULT NOW() | 작성 시각 |

**인덱스:**
- inquiry_id

**연관:**
- inquiry_id 추가되면 inquiry.status 자동으로 'in_progress'로 변경

---

## 📄 4. landing_contents (랜딩 페이지 콘텐츠)

**설명:** 관리자가 편집할 수 있는 랜딩 페이지 콘텐츠. 단일 레코드 (id='main')

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | text | PK | 'main' (고정) |
| hero_title | text | - | 히어로 섹션 제목 |
| hero_subtitle | text | - | 히어로 섹션 부제목 |
| hero_image_url | text | - | 히어로 이미지 URL |
| before_after_items | jsonb | - | [{before_url, after_url, caption}] |
| reviews | jsonb | - | [{author, text, rating}] |
| footer_content | text | - | 푸터 텍스트 |
| updated_at | timestamp | DEFAULT NOW() | 마지막 수정 시각 |

**예시 (JSON):**
```json
{
  "before_after_items": [
    {
      "before_url": "https://...",
      "after_url": "https://...",
      "caption": "시술 전후"
    }
  ],
  "reviews": [
    {
      "author": "김철수",
      "text": "매우 만족합니다",
      "rating": 5
    }
  ]
}
```

---

## 🛍️ 5. products (상품)

**설명:** 판매 상품 정보

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | uuid | PK | 상품 고유 ID |
| name | text | NOT NULL | 상품명 (예: "아라오") |
| price | numeric | NOT NULL | 기본 가격 |
| currency | text | DEFAULT 'KRW' | 화폐 단위 |
| active | boolean | DEFAULT true | 활성 여부 |
| created_at | timestamp | DEFAULT NOW() | 생성 시각 |

**예시:**
```
"아라오" - 50,000 KRW
"아라오 프리미엄" - 80,000 KRW
```

---

## 🎨 6. product_options (상품 옵션)

**설명:** 상품별 옵션 (soft/bw/std 등)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | uuid | PK | 옵션 고유 ID |
| product_id | uuid | FK→products | 상품 ID |
| name | text | NOT NULL | 옵션명 (soft/bw/std) |
| price | numeric | - | 옵션 추가 가격 (NULL = 기본가격) |
| created_at | timestamp | DEFAULT NOW() | 생성 시각 |

**예시:**
```
product_id: abc123, name: "soft", price: NULL (기본가격 사용)
product_id: abc123, name: "bw", price: 5000 (추가 비용)
```

---

## 📦 7. orders (주문)

**설명:** 사용자의 주문 정보

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | uuid | PK | 주문 고유 ID |
| user_id | uuid | FK→profiles | 주문자 |
| status | text | DEFAULT 'pending' | 결제완료 \| 환불진행중 \| 환불완료 \| 결제오류 |
| total_amount | numeric | NOT NULL | 총 주문 금액 |
| currency | text | DEFAULT 'KRW' | 화폐 단위 |
| payment_provider | text | - | 결제 수단 (신한카드 등) |
| created_at | timestamp | DEFAULT NOW() | 주문 생성 시각 |

**인덱스:**
- user_id
- status

**상태:**
- 결제완료 (파랑)
- 환불진행중 (노랑)
- 환불완료 (자주)
- 결제오류 (빨강)

---

## 💳 8. payments (결제 정보)

**설명:** 각 주문의 결제 상세 정보. 1주문 = 1결제

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | uuid | PK | 결제 고유 ID |
| order_id | uuid | FK→orders (UNIQUE) | 주문 ID (1:1) |
| provider | text | - | 결제 제공사 (신한카드/삼성카드/네이버페이 등) |
| provider_payment_id | text | - | 결제사 거래번호 |
| status | text | - | completed \| failed \| pending |
| amount | numeric | NOT NULL | 결제 금액 |
| currency | text | DEFAULT 'KRW' | 화폐 단위 |
| created_at | timestamp | DEFAULT NOW() | 결제 생성 시각 |

**관계:**
- order_id (UNIQUE) → 1주문 당 1건의 결제만 가능

---

## 📅 9. order_items (주문 라인 아이템) [계획]

**설명:** 1주문에 여러 상품이 포함된 경우 사용 (향후 구현)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | uuid | PK | 라인 아이템 ID |
| order_id | uuid | FK→orders | 주문 ID |
| product_id | uuid | FK→products | 상품 ID |
| product_name | text | - | 상품명 (스냅샷) |
| product_option | text | - | 선택한 옵션 (스냅샷) |
| quantity | integer | DEFAULT 1 | 수량 |
| unit_price | numeric | - | 단가 |
| created_at | timestamp | DEFAULT NOW() | 생성 시각 |

**사용 시기:** 장바구니 → 다중 상품 주문 기능 추가 시

---

## 🔗 관계도 (ERD)

```
profiles (사용자)
  ├── 1:N → inquiries (상담)
  ├── 1:N → inquiry_replies (답변)
  └── 1:N → orders (주문)

products (상품)
  └── 1:N → product_options (옵션)

orders (주문)
  ├── N:1 → profiles (주문자)
  ├── 1:1 → payments (결제)
  └── 1:N → order_items (라인 아이템) [향후]

landing_contents (콘텐츠)
  └── 단일 레코드 (id='main')
```

---

## 🔐 Row-Level Security (RLS) 정책

| 테이블 | 정책 | 설명 |
|--------|------|------|
| profiles | SELECT | 자신의 프로필만 조회 |
| inquiries | SELECT | 자신의 상담만 조회 (admin 제외) |
| orders | SELECT | 자신의 주문만 조회 (admin 제외) |
| payments | SELECT | 자신의 결제만 조회 (admin 제외) |

---

## 📝 테이블 생성 SQL

전체 테이블을 한번에 생성할 SQL은 `WORK_SUMMARY_20260327.md`에 포함되어 있습니다.

---

## 🔄 데이터 흐름

```
사용자 가입 (Clerk)
  ↓
syncProfile() → profiles 테이블 생성
  ↓
사용자 상담 제출 → inquiries 생성
  ↓
관리자 답변 → inquiry_replies 생성
  ↓
사용자 상품 주문 → orders 생성
  ↓
결제 → payments 생성
  ↓
결제 상태 변경 → orders.status 업데이트
```

---

## 💡 설계 원칙

1. **정규화:** 중복 데이터 최소화 (e.g., 상품명은 스냅샷으로 저장)
2. **감시:** 모든 테이블에 created_at (일부 updated_at) 포함
3. **소유권 검증:** user_id로 자신의 데이터만 조회
4. **상태 관리:** 상담/주문 상태를 명확한 enum 형식으로 관리
5. **확장성:** order_items 테이블 준비 (향후 다중상품 주문)

---

**마지막 수정:** 2026-03-27
**관리:** Supabase (PostgreSQL)
