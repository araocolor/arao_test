"use client";

import { ReactNode, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useAccountPrefetch } from "@/hooks/use-account-prefetch";
import { useInactivityLogout } from "@/hooks/use-inactivity-logout";
import { useGalleryPrefetch } from "@/hooks/use-gallery-prefetch";
import { setCached } from "@/hooks/use-prefetch-cache";
import { GALLERY_CATEGORIES } from "@/lib/gallery-categories";
import { REVIEW_LIST_CACHE_TTL, COLOR_LIST_CACHE_TTL } from "@/lib/cache-config";
import { getCachedPurchasedColorIds, refreshPurchasedColorIdsCache } from "@/lib/color-purchase-cache";
const REVIEW_PREFETCH_LOCK_KEY = "user-review-list-prefetch-lock";
const REVIEW_PREFETCH_LOCK_MS = 10000;
const COLOR_PREFETCH_LOCK_KEY = "color-list-prefetch-lock";
const COLOR_PREFETCH_LOCK_MS = 10000;

function canPrefetchReviewList(): boolean {
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (!connection) return true;
  if (connection.saveData) return false;
  if (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g") return false;
  return true;
}

function isReviewPrefetchLocked(): boolean {
  try {
    const raw = sessionStorage.getItem(REVIEW_PREFETCH_LOCK_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < REVIEW_PREFETCH_LOCK_MS;
  } catch {
    return false;
  }
}

/** 커뮤니티 리스트 캐시 갱신 */
function refreshUserReviewListCache() {
  if (!canPrefetchReviewList()) return;
  if (isReviewPrefetchLocked()) return;
  sessionStorage.setItem(REVIEW_PREFETCH_LOCK_KEY, String(Date.now()));

  fetch("/api/main/user-review?page=1&limit=20&sort=latest")
    .then((r) => (r.ok ? r.json() : null))
    .then((data: { items: Array<{ thumbnailImage?: string | null; thumbnailFirst?: string | null; [key: string]: unknown }>; [key: string]: unknown }) => {
      if (!data) return;
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
    .catch(() => {})
    .finally(() => {
      sessionStorage.removeItem(REVIEW_PREFETCH_LOCK_KEY);
    });
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

function isColorPrefetchLocked(): boolean {
  try {
    const raw = sessionStorage.getItem(COLOR_PREFETCH_LOCK_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < COLOR_PREFETCH_LOCK_MS;
  } catch {
    return false;
  }
}

type ColorPrefetchItem = {
  id: string;
  title: string;
  content: string | null;
  price: number | null;
  file_link: string | null;
  purchased?: boolean;
  like_count: number;
  img_arao_mid: string | null;
  img_arao_full: string | null;
  img_portrait_full: string | null;
  img_standard_full: string | null;
};

function preloadImages(urls: (string | null)[]): Promise<void> {
  return Promise.all(
    urls.filter(Boolean).map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = document.createElement("img");
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = src!;
        })
    )
  ).then(() => undefined);
}

/** 컬러 리스트 캐시 갱신 + 순차 이미지 프리로드 */
function refreshColorListCache() {
  if (!canPrefetchReviewList()) return;
  if (isColorPrefetchLocked()) return;
  sessionStorage.setItem(COLOR_PREFETCH_LOCK_KEY, String(Date.now()));
  fetch("/api/color?page=1&limit=20")
    .then((r) => (r.ok ? r.json() : null))
    .then(async (json: { items?: Array<ColorPrefetchItem> } | null) => {
      if (!json?.items) return;
      const items = json.items.map(({ id, title, content, price, file_link, purchased, like_count, img_arao_mid, img_arao_full, img_portrait_full, img_standard_full }) => ({
        id, title, content: content ?? null, price: price ?? null, file_link: file_link ?? null, purchased: purchased ?? undefined, like_count, img_arao_mid, img_arao_full, img_portrait_full, img_standard_full,
      }));
      sessionStorage.setItem("color-list-cache", JSON.stringify({ data: items, ts: Date.now() }));

      // 1단계: arao mid (480) — 리스트 즉시 표시용
      await preloadImages(items.map((i) => i.img_arao_mid));
    })
    .catch(() => {})
    .finally(() => {
      sessionStorage.removeItem(COLOR_PREFETCH_LOCK_KEY);
    });
}

/** 캐시 타임스탬프가 만료됐는지 확인 */
function isStale(key: string, maxAge = REVIEW_LIST_CACHE_TTL): boolean {
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
  const { user, isSignedIn } = useUser();
  useAccountPrefetch(isSignedIn ?? false);
  useInactivityLogout();
  useGalleryPrefetch(user?.id ?? null);

  useEffect(() => {
    // 첫 페이지 도착 시 캐시가 만료됐으면 1회 갱신
    if (isStale("user-review-list-cache")) {
      refreshUserReviewListCache();
    }
    if (isStale(`arao_prefetch_gallery_public_${GALLERY_CATEGORIES[0]}_0`)) {
      refreshGalleryCache();
    }
    if (isStale("color-list-cache", COLOR_LIST_CACHE_TTL)) {
      refreshColorListCache();
    }
    if (isSignedIn && !getCachedPurchasedColorIds()) {
      void refreshPurchasedColorIdsCache();
    }
  }, [isSignedIn]);

  return <>{children}</>;
}
