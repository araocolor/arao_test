"use client";

import { ReactNode, useEffect } from "react";
import { useAccountPrefetch } from "@/hooks/use-account-prefetch";
import { useInactivityLogout } from "@/hooks/use-inactivity-logout";
import { useGalleryPrefetch } from "@/hooks/use-gallery-prefetch";
import { setCached } from "@/hooks/use-prefetch-cache";
import { GALLERY_CATEGORIES } from "@/lib/gallery-categories";

/** 커뮤니티 리스트 캐시 갱신 (TTL 무시, 강제 fetch) */
function refreshUserReviewListCache() {
  fetch("/api/main/user-review?page=1&limit=20&sort=latest")
    .then((r) => r.json())
    .then((data: { items: Array<{ thumbnailImage?: string | null; thumbnailFirst?: string | null; [key: string]: unknown }>; [key: string]: unknown }) => {
      const slim = {
        ...data,
        items: Array.isArray(data.items)
          ? data.items.map((item) => {
              let firstImage: string | null = null;
              if (item.thumbnailImage) {
                try {
                  const parsed = JSON.parse(item.thumbnailImage);
                  firstImage = Array.isArray(parsed) ? (parsed[0] ?? null) : item.thumbnailImage;
                } catch {
                  firstImage = item.thumbnailImage;
                }
              }
              return { ...item, thumbnailImage: firstImage, thumbnailFirst: item.thumbnailFirst ?? null };
            })
          : [],
      };
      sessionStorage.setItem("user-review-list-cache", JSON.stringify({ data: slim, ts: Date.now() }));
    })
    .catch(() => {});
}

/** 갤러리 공용 캐시 갱신 (첫 3개 카드) */
function refreshGalleryCache() {
  GALLERY_CATEGORIES.slice(0, 3).forEach((category, index) => {
    fetch(`/api/gallery/${category}/${index}/likes`)
      .then((r) => r.json())
      .then((d: { count?: number; firstLiker?: string | null; commentCount?: number }) => {
        setCached(`gallery_public_${category}_${index}`, {
          count: d.count ?? 0,
          firstLiker: d.firstLiker ?? null,
          commentCount: d.commentCount ?? 0,
        });
      })
      .catch(() => {});
  });
}

/** 캐시 타임스탬프가 5초 이상 경과했는지 확인 */
function isStale(key: string, maxAge = 5000): boolean {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return true;
    const { ts } = JSON.parse(raw) as { ts: number };
    return Date.now() - ts >= maxAge;
  } catch {
    return true;
  }
}

export function AccountPrefetchWrapper({ children }: { children: ReactNode }) {
  useAccountPrefetch();
  useInactivityLogout();
  useGalleryPrefetch();

  useEffect(() => {
    // 첫 페이지 도착 시, 캐시가 5초 이상 경과했으면 1회 갱신
    if (isStale("user-review-list-cache")) {
      refreshUserReviewListCache();
    }
    if (isStale(`arao_prefetch_gallery_public_${GALLERY_CATEGORIES[0]}_0`)) {
      refreshGalleryCache();
    }
  }, []);

  return <>{children}</>;
}
