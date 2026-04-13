"use client";

import { useEffect, useRef, useState } from "react";

type UserReviewItem = {
  id: string;
  title: string;
  content: string;
  thumbnailImage: string | null;
  thumbnailSmall: string | null;
  thumbnailFirst: string | null;
  attachedFile: string | null;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  authorId: string;
  isAuthor?: boolean;
  isPinned?: boolean;
  isGlobalPinned?: boolean;
};

function getFirstImage(thumbnailImage: string | null): string | null {
  if (!thumbnailImage) return null;
  try {
    const parsed = JSON.parse(thumbnailImage);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed[0] as string;
  } catch {}
  return thumbnailImage;
}

function get480Url(url: string): string {
  try {
    const u = new URL(url);
    if (u.pathname.includes("/storage/v1/object/public/")) {
      const renderUrl = url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
      return `${renderUrl}?width=480&resize=cover`;
    }
  } catch {}
  return url;
}

export function UserReviewAlbum({
  items: initialItems,
  readIds,
  onOpenReview,
  board = "review",
  sort = "latest",
  query = "",
  totalPages = 1,
  onNewItemsLoaded,
}: {
  items: UserReviewItem[];
  readIds: Set<string>;
  onOpenReview: (id: string) => void;
  board?: string;
  sort?: string;
  query?: string;
  totalPages?: number;
  onNewItemsLoaded?: (items: UserReviewItem[]) => void;
}) {
  const [allItems, setAllItems] = useState<UserReviewItem[]>(initialItems);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hdSrcs, setHdSrcs] = useState<Record<string, string>>({});
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = currentPage < totalPages;

  // initialItems 변경 시(게시판/정렬 변경) 목록 초기화
  useEffect(() => {
    setAllItems(initialItems);
    setCurrentPage(1);
    setHdSrcs({});
  }, [initialItems]);

  // 480px 백그라운드 교체
  useEffect(() => {
    allItems.forEach((item) => {
      if (hdSrcs[item.id]) return;
      const fullUrl = getFirstImage(item.thumbnailImage);
      if (!fullUrl) return;
      const hdUrl = get480Url(fullUrl);
      if (hdUrl === (item.thumbnailFirst ?? fullUrl)) return;
      const img = new Image();
      img.onload = () => {
        setHdSrcs((prev) => ({ ...prev, [item.id]: hdUrl }));
      };
      img.src = hdUrl;
    });
  }, [allItems]);

  // 하단 도달 시 다음 페이지 로드
  useEffect(() => {
    if (!hasMore || loadingMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      const nextPage = currentPage + 1;
      setLoadingMore(true);
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: "20",
        sort,
        board,
      });
      if (query) params.set("q", query);
      fetch(`/api/main/user-review?${params.toString()}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { items?: UserReviewItem[] } | null) => {
          if (!data?.items?.length) return;
          setAllItems((prev) => [...prev, ...data.items!]);
          setCurrentPage(nextPage);
          onNewItemsLoaded?.(data.items!);
        })
        .catch(() => {})
        .finally(() => setLoadingMore(false));
    }, { rootMargin: "200px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, currentPage, board, sort, query]);

  return (
    <>
      <div className="user-review-album">
        {allItems.map((item) => {
          const thumb = item.thumbnailFirst ?? getFirstImage(item.thumbnailImage);
          const displaySrc = hdSrcs[item.id] ?? thumb;
          const pinned = item.isPinned || item.isGlobalPinned;
          if (pinned) return null;
          return (
            <button
              key={item.id}
              type="button"
              className={`user-review-item album${item.isAuthor ? " mine" : ""}`}
              onClick={() => onOpenReview(item.id)}
            >
              <div className="user-review-album-thumb">
                {displaySrc ? (
                  <img src={displaySrc} alt="" loading="lazy" />
                ) : (
                  <span className="user-review-item-thumb-empty" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  </span>
                )}
                {/* 좋아요 배지 숨김 */}
              </div>
            </button>
          );
        })}
      </div>
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
      {loadingMore && (
        <div className="user-review-album-loading">
          <span className="user-review-album-loading-dot" />
          <span className="user-review-album-loading-dot" />
          <span className="user-review-album-loading-dot" />
        </div>
      )}
    </>
  );
}
