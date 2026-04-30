-- 복구 회원 재탈퇴 제한(14일)용 컬럼 추가
alter table if exists public.profiles
  add column if not exists withdraw_restricted_until timestamptz;
