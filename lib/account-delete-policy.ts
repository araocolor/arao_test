const DAY_MS = 24 * 60 * 60 * 1000;

export const RESTORED_WITHDRAW_LOCK_DAYS = 14;

export function getRestoreWithdrawRestrictedUntil(nowMs = Date.now()): string {
  return new Date(nowMs + RESTORED_WITHDRAW_LOCK_DAYS * DAY_MS).toISOString();
}

export function getWithdrawRestrictionDaysLeft(
  withdrawRestrictedUntil: string | null | undefined,
  nowMs = Date.now(),
): number {
  if (!withdrawRestrictedUntil) return 0;
  const untilMs = new Date(withdrawRestrictedUntil).getTime();
  if (!Number.isFinite(untilMs)) return 0;
  const remainMs = untilMs - nowMs;
  if (remainMs <= 0) return 0;
  return Math.max(0, Math.ceil(remainMs / DAY_MS));
}

export function isWithdrawRestricted(
  withdrawRestrictedUntil: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  return getWithdrawRestrictionDaysLeft(withdrawRestrictedUntil, nowMs) > 0;
}
