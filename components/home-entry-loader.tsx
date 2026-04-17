"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { getCached, setCached } from "@/hooks/use-prefetch-cache";

const HOME_ENTRY_LOADER_MS = 1000;

type ReviewListItem = {
  thumbnailImage?: string | null;
  thumbnailFirst?: string | null;
  [key: string]: unknown;
};

type GalleryLikePayload = {
  count?: number;
  firstLiker?: string | null;
  commentCount?: number;
  liked?: boolean;
};

function slimReviewItems(items: ReviewListItem[]): ReviewListItem[] {
  return items.map((item) => {
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
  });
}

function setReviewListCache(cacheKey: string, payload: { items?: ReviewListItem[]; [key: string]: unknown }) {
  if (!Array.isArray(payload.items)) return;
  const slim = { ...payload, items: slimReviewItems(payload.items) };
  sessionStorage.setItem(cacheKey, JSON.stringify({ data: slim, ts: Date.now() }));
}

function setGalleryLikeCaches(category: string, index: number, data: GalleryLikePayload) {
  const count = data.count ?? 0;
  const firstLiker = data.firstLiker ?? null;
  const commentCount = data.commentCount ?? 0;

  setCached(`gallery_public_${category}_${index}`, { count, firstLiker, commentCount });
  setCached(`gallery_card_${category}_${index}_guest`, { count, liked: data.liked ?? false, firstLiker, commentCount });
}

function prefetchHomeFastPack() {
  const tasks: Array<Promise<void>> = [];

  if (!getCached("gallery_public_people_0")) {
    tasks.push(
      fetch("/api/gallery/people/0/likes")
        .then((r) => (r.ok ? r.json() : null))
        .then((d: GalleryLikePayload | null) => {
          if (!d) return;
          setGalleryLikeCaches("people", 0, d);
        })
        .catch(() => {})
    );
  }

  if (!getCached("gallery_comments_people_0")) {
    tasks.push(
      fetch("/api/gallery/people/0/comments")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) return;
          setCached("gallery_comments_people_0", d);
        })
        .catch(() => {})
    );
  }

  if (!getCached("gallery_public_outdoor_1")) {
    tasks.push(
      fetch("/api/gallery/outdoor/1/likes")
        .then((r) => (r.ok ? r.json() : null))
        .then((d: GalleryLikePayload | null) => {
          if (!d) return;
          setGalleryLikeCaches("outdoor", 1, d);
        })
        .catch(() => {})
    );
  }

  if (!getCached("gallery_public_indoor_2")) {
    tasks.push(
      fetch("/api/gallery/indoor/2/likes")
        .then((r) => (r.ok ? r.json() : null))
        .then((d: GalleryLikePayload | null) => {
          if (!d) return;
          setGalleryLikeCaches("indoor", 2, d);
        })
        .catch(() => {})
    );
  }

  try {
    const cachedArao = sessionStorage.getItem("user-review-list-cache-arao");
    if (!cachedArao) {
      tasks.push(
        fetch("/api/main/user-review?page=1&limit=20&sort=latest&board=arao")
          .then((r) => (r.ok ? r.json() : null))
          .then((d: { items?: ReviewListItem[]; [key: string]: unknown } | null) => {
            if (!d) return;
            setReviewListCache("user-review-list-cache-arao", d);
          })
          .catch(() => {})
      );
    }
  } catch {}

  void Promise.allSettled(tasks);
}

type HomeEntryLoaderProps = {
  children: ReactNode;
};

function hasLandingCache(): boolean {
  try {
    return !!(
      sessionStorage.getItem("color-items") ||
      sessionStorage.getItem("color-list-cache") ||
      sessionStorage.getItem("user-review-list-cache-arao")
    );
  } catch {
    return false;
  }
}

export function HomeEntryLoader({ children }: HomeEntryLoaderProps) {
  const [ready, setReady] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    prefetchHomeFastPack();

    // 캐시 있으면 즉시 표시, 없으면 1초 대기
    if (hasLandingCache()) {
      setReady(true);
      return;
    }

    timeoutRef.current = setTimeout(() => {
      setReady(true);
      timeoutRef.current = null;
    }, HOME_ENTRY_LOADER_MS);

    return () => {
      if (!timeoutRef.current) return;
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    };
  }, []);

  if (!ready) {
    return (
      <main className="landing-entry-loader" aria-label="로딩">
        <div className="landing-entry-loader-bar-track" aria-hidden="true">
          <div className="landing-entry-loader-bar-fill" />
        </div>
      </main>
    );
  }

  return <>{children}</>;
}

