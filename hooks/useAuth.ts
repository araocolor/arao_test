"use client";

/**
 * 인증 훅 — @clerk/nextjs 래핑
 * React Native 전환 시 내부 import만 @clerk/clerk-expo 로 교체
 *
 * 사용법:
 *   const { isSignedIn, userId, isLoaded } = useAuth()
 */

import { useUser } from "@clerk/nextjs";

export function useAuth() {
  const { isSignedIn, isLoaded, user } = useUser();

  return {
    isSignedIn: isSignedIn ?? false,
    isLoaded,
    userId: user?.id ?? null,
    email:  user?.primaryEmailAddress?.emailAddress ?? null,
  };
}
