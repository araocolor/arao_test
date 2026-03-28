create table if not exists profiles (
  id uuid primary key,
  email text unique,
  role text not null default 'customer',
  full_name text,
  phone text,
  username text,
  password_hash text,
  created_at timestamptz not null default now()
);

alter table profiles add column if not exists username text;
alter table profiles add column if not exists password_hash text;
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
  item_category text not null,
  item_index    int not null,
  content       text not null,
  like_count    int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists gallery_comments_category_idx on gallery_comments (item_category, item_index);

-- 갤러리 댓글 좋아요
create table if not exists gallery_comment_likes (
  comment_id uuid not null references gallery_comments(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, profile_id)
);

alter table profiles add column if not exists icon_image text;
alter table profiles alter column icon_image type text using icon_image::text;
