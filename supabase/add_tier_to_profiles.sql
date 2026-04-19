-- profiles 테이블에 tier 컬럼 추가 및 role 기본값 변경
-- tier: general(회원가입) | pro(일반상품 구매) | premium(아라오 구매)
-- role: member(회원가입) | creator(상품등록 권한) | admin(관리자, 수동지정)

alter table if exists public.profiles
  add column if not exists tier text not null default 'general';

alter table if exists public.profiles
  alter column role set default 'member';

-- 기존 데이터 마이그레이션: user/customer → member
update public.profiles
  set role = 'member'
  where role in ('user', 'customer');
