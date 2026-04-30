create table if not exists profiles (
  id uuid primary key,
  email text unique,
  role text not null default 'customer',
  notification_enabled boolean not null default true,
  full_name text,
  phone text,
  username text,
  password_hash text,
  created_at timestamptz not null default now()
);

alter table profiles add column if not exists username text;
alter table profiles add column if not exists password_hash text;
alter table profiles add column if not exists notification_enabled boolean not null default true;
create unique index if not exists profiles_username_key on profiles (username) where username is not null;

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(12, 2) not null,
  currency text not null default 'KRW',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  status text not null default 'pending',
  total_amount numeric(12, 2) not null,
  currency text not null default 'KRW',
  payment_provider text,
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id),
  quantity integer not null default 1,
  unit_price numeric(12, 2) not null
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  provider text not null,
  provider_payment_id text,
  status text not null default 'ready',
  amount numeric(12, 2) not null,
  currency text not null default 'KRW',
  created_at timestamptz not null default now()
);

create table if not exists landing_contents (
  id text primary key,
  content jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists inquiries (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references profiles(id) on delete cascade,
  type             text not null check (type in ('consulting', 'general')),
  title            text not null,
  content          text not null,
  status           text not null default 'pending'
                     check (status in ('pending', 'in_progress', 'resolved', 'closed')),
  has_unread_reply boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists inquiry_replies (
  id           uuid primary key default gen_random_uuid(),
  inquiry_id   uuid not null references inquiries(id) on delete cascade,
  author_role  text not null check (author_role in ('customer', 'admin')),
  content      text not null,
  created_at   timestamptz not null default now()
);

create index if not exists inquiries_profile_id_idx on inquiries (profile_id);
create index if not exists inquiry_replies_inquiry_id_idx on inquiry_replies (inquiry_id);

-- 알림 통합 테이블 (주문, 리뷰, 갤러리 알림)
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  type       text not null,
  title      text not null,
  link       text not null,
  source_id  text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_profile_id_idx on notifications (profile_id);

-- 리뷰 게시판
create table if not exists reviews (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  category   text not null default 'general',
  title      text not null,
  content    text not null,
  like_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reviews_profile_id_idx on reviews (profile_id);

-- 리뷰 좋아요
create table if not exists review_likes (
  review_id  uuid not null references reviews(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, profile_id)
);

-- 리뷰 답글
create table if not exists review_replies (
  id         uuid primary key default gen_random_uuid(),
  review_id  uuid not null references reviews(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists review_replies_review_id_idx on review_replies (review_id);

-- 사용자 리뷰 (main/user_review 전용)
create table if not exists user_reviews (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references profiles(id) on delete cascade,
  title           text not null,
  content         text not null,
  thumbnail_image text,
  view_count      int not null default 0,
  like_count      int not null default 0,
  is_public       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists user_reviews_profile_id_idx on user_reviews (profile_id);
create index if not exists user_reviews_created_at_idx on user_reviews (created_at desc);

create table if not exists user_review_likes (
  review_id   uuid not null references user_reviews(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (review_id, profile_id)
);

create table if not exists user_review_comments (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references user_reviews(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  parent_id   uuid references user_review_comments(id) on delete cascade,
  is_deleted  boolean not null default false,
  deleted_at  timestamptz,
  content     text not null,
  like_count  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists user_review_comments_review_id_idx on user_review_comments (review_id, created_at);
create index if not exists user_review_comments_parent_idx on user_review_comments (parent_id);

create table if not exists user_review_comment_likes (
  comment_id  uuid not null references user_review_comments(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (comment_id, profile_id)
);

-- 갤러리 이미지 좋아요
create table if not exists gallery_item_likes (
  item_category text not null,
  item_index    int not null,
  profile_id    uuid not null references profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (item_category, item_index, profile_id)
);

-- 갤러리 댓글
create table if not exists gallery_comments (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id) on delete cascade,
  parent_id     uuid references gallery_comments(id) on delete cascade,
  is_deleted    boolean not null default false,
  deleted_at    timestamptz,
  item_category text not null,
  item_index    int not null,
  content       text not null,
  like_count    int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists gallery_comments_category_idx on gallery_comments (item_category, item_index);
create index if not exists gallery_comments_parent_idx on gallery_comments (parent_id);

alter table gallery_comments add column if not exists parent_id uuid references gallery_comments(id) on delete cascade;
alter table gallery_comments add column if not exists is_deleted boolean not null default false;
alter table gallery_comments add column if not exists deleted_at timestamptz;

-- 갤러리 댓글 좋아요
create table if not exists gallery_comment_likes (
  comment_id uuid not null references gallery_comments(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, profile_id)
);

alter table profiles add column if not exists icon_image text;
alter table profiles alter column icon_image type text using icon_image::text;
alter table profiles add column if not exists withdraw_restricted_until timestamptz;

-- 작업 로그/보고서 (관리자 전용 운영 기록)
create table if not exists work_logs (
  id                    uuid primary key default gen_random_uuid(),
  commit_hash           text not null unique,
  title                 text not null,
  summary               text not null default '',
  details               text,
  original_review       text,
  status                text not null default 'done' check (status in ('draft', 'done', 'rollback')),
  report_url            text,
  deployed_at           timestamptz,
  author_profile_id     uuid references profiles(id) on delete set null,
  author_name_snapshot  text not null default '',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table work_logs add column if not exists original_review text;

create index if not exists work_logs_created_at_idx on work_logs (created_at desc);
create index if not exists work_logs_status_created_at_idx on work_logs (status, created_at desc);
create index if not exists work_logs_author_created_at_idx on work_logs (author_profile_id, created_at desc);

create table if not exists work_log_memos (
  id                       uuid primary key default gen_random_uuid(),
  work_log_id              uuid not null references work_logs(id) on delete cascade,
  memo                     text not null,
  created_by_profile_id    uuid references profiles(id) on delete set null,
  created_by_name_snapshot text not null default '',
  created_at               timestamptz not null default now()
);

create index if not exists work_log_memos_work_log_created_idx on work_log_memos (work_log_id, created_at desc);
