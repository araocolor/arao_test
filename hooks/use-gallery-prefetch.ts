"use client";

/**
 * 랜딩 페이지에서 갤러리 첫 번째 카드 데이터를 미리 캐시
 * - 1.5초 후 백그라운드에서 실행 (랜딩 렌더링 방해 안 함)
 * - sessionStorage TTL 5분
 */

import { useEffect } from "react";
import { getCached, setCached } from "./use-prefetch-cache";
import { GALLERY_CATEGORIES } from "@/lib/gallery-categories";

export function useGalleryPrefetch() {
  useEffect(() => {
    // 첫 두 카드가 이미 캐시됐으면 스킵
    const firstCategory = GALLERY_CATEGORIES[0];
    const secondCategory = GALLERY_CATEGORIES[1];
    if (getCached(`gallery_card_${firstCategory}_0`) && getCached(`gallery_card_${secondCategory}_1`)) {
      return;
    }

    const timer = setTimeout(() => {
      void prefetchGalleryCards();
    }, 1500);

    return () => clearTimeout(timer);
  }, []);
}

async function prefetchGalleryCards() {
  // 첫 3개 카드 병렬 prefetch
  await Promise.allSettled(
    GALLERY_CATEGORIES.slice(0, 3).map((category, index) =>
      prefetchCard(category, index)
    )
  );
}

async function prefetchCard(category: string, index: number) {
  const key = `gallery_card_${category}_${index}`;
  if (getCached(key)) return;

  try {
    const res = await fetch(`/api/gallery/${category}/${index}/likes`);
    if (!res.ok) return;
    const data = await res.json();
    setCached(key, data);
  } catch {
    // prefetch 실패는 무시 — 갤러리 카드에서 직접 fetch
  }
}
