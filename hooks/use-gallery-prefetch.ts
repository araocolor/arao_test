"use client";

/**
 * 갤러리 첫 3개 카드 데이터를 미리 캐시
 * - 1.5초 후 백그라운드에서 실행 (랜딩 렌더링 방해 안 함)
 * - 게스트: _guest 키로 저장
 * - 로그인: _guest + _{userId} 키 모두 저장 (liked 색상 즉시 표시)
 * - sessionStorage TTL 1분 (PREFETCH_CACHE_TTL)
 */

import { useEffect } from "react";
import { getCached, setCached } from "./use-prefetch-cache";
import { GALLERY_CATEGORIES } from "@/lib/gallery-categories";

export function useGalleryPrefetch(userId?: string | null) {
  useEffect(() => {
    const firstCategory = GALLERY_CATEGORIES[0];
    const secondCategory = GALLERY_CATEGORIES[1];

    // 로그인 사용자: userId 기반 캐시가 없으면 항상 prefetch (liked 반영)
    // 게스트: guest 캐시가 이미 두 개 있으면 스킵
    if (!userId) {
      if (
        getCached(`gallery_card_${firstCategory}_0_guest`) &&
        getCached(`gallery_card_${secondCategory}_1_guest`)
      ) {
        return;
      }
    } else {
      if (
        getCached(`gallery_card_${firstCategory}_0_${userId}`) &&
        getCached(`gallery_card_${secondCategory}_1_${userId}`)
      ) {
        return;
      }
    }

    const timer = setTimeout(() => {
      void prefetchGalleryCards(userId ?? null);
    }, 1500);

    return () => clearTimeout(timer);
  // userId가 바뀌면(로그인/로그아웃) 재실행
  }, [userId]);
}

async function prefetchGalleryCards(userId: string | null) {
  // 첫 3개 카드 병렬 prefetch
  await Promise.allSettled(
    GALLERY_CATEGORIES.slice(0, 3).map((category, index) =>
      prefetchCard(category, index, userId)
    )
  );
}

async function prefetchCard(category: string, index: number, userId: string | null) {
  const guestKey = `gallery_card_${category}_${index}_guest`;
  const userKey = userId ? `gallery_card_${category}_${index}_${userId}` : null;

  // 게스트 캐시도 없고 userId 캐시도 없을 때만 fetch
  const needsFetch = !getCached(guestKey) || (userKey && !getCached(userKey));
  if (!needsFetch) return;

  try {
    const res = await fetch(`/api/gallery/${category}/${index}/likes`);
    if (!res.ok) return;
    const data = await res.json();

    // 게스트 캐시: liked=false 강제 (게스트용)
    if (!getCached(guestKey)) {
      setCached(guestKey, { ...data, liked: false });
    }

    // 로그인 사용자 캐시: API 응답 그대로 저장 (liked 포함)
    if (userKey && !getCached(userKey)) {
      setCached(userKey, data);
    }

    // publicCacheKey도 갱신
    const publicKey = `gallery_public_${category}_${index}`;
    if (!getCached(publicKey)) {
      setCached(publicKey, {
        count: data.count ?? 0,
        firstLiker: data.firstLiker ?? null,
        commentCount: data.commentCount ?? 0,
      });
    }
  } catch {
    // prefetch 실패는 무시 — 갤러리 카드에서 직접 fetch
  }
}
