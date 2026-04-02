"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { UserContentHeader } from "@/components/user-content-header";
import { UserContentInteractions } from "@/components/user-content-interactions";

function ContentImage({
  src,
  index,
  onClickView,
}: {
  src: string;
  index: number;
  onClickView: (index: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <button
      type="button"
      className="user-content-thumb-btn"
      onClick={() => onClickView(index)}
    >
      <img
        src={src}
        alt=""
        className="user-content-thumb"
        style={{ opacity: loaded ? 1 : 0 }}
        onLoad={() => setLoaded(true)}
      />
    </button>
  );
}

function ImageViewer({
  images,
  startIndex,
  onClose,
}: {
  images: string[];
  startIndex: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(startIndex);
  const [showUI, setShowUI] = useState(true);
  const [loadedSet, setLoadedSet] = useState<Set<number>>(() => new Set());
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const total = images.length;
  const hasPrev = current > 0;
  const hasNext = current < total - 1;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // 키보드 네비게이션
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) setCurrent((c) => c - 1);
      if (e.key === "ArrowRight" && hasNext) setCurrent((c) => c + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasPrev, hasNext, onClose]);

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.t;
    touchStartRef.current = null;

    // 탭 (이동 적음, 시간 짧음) → UI 토글
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20 && dt < 300) {
      setShowUI((v) => !v);
      return;
    }

    // 스와이프 (수평 50px 이상)
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0 && hasNext) setCurrent((c) => c + 1);
      if (dx > 0 && hasPrev) setCurrent((c) => c - 1);
    }
  }

  function handleImageLoaded(index: number) {
    setLoadedSet((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }

  return (
    <div
      ref={containerRef}
      className="user-content-viewer-overlay"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* X 닫기 버튼 */}
      {showUI && (
        <button
          type="button"
          className="user-content-viewer-close"
          onClick={onClose}
          aria-label="닫기"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      {/* 페이지 표시 */}
      {showUI && total > 1 && (
        <div className="user-content-viewer-counter">
          {current + 1} / {total}
        </div>
      )}

      {/* 이미지 */}
      <div className="user-content-viewer-wrap">
        {!loadedSet.has(current) && <div className="user-content-viewer-spinner" />}
        <img
          key={current}
          src={images[current]}
          alt=""
          className="user-content-viewer-img"
          style={{ opacity: loadedSet.has(current) ? 1 : 0 }}
          onLoad={() => handleImageLoaded(current)}
        />
      </div>

      {/* 데스크탑 좌우 화살표 */}
      {showUI && hasPrev && (
        <button
          type="button"
          className="user-content-viewer-arrow left"
          onClick={(e) => { e.stopPropagation(); setCurrent((c) => c - 1); }}
          aria-label="이전"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}
      {showUI && hasNext && (
        <button
          type="button"
          className="user-content-viewer-arrow right"
          onClick={(e) => { e.stopPropagation(); setCurrent((c) => c + 1); }}
          aria-label="다음"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </button>
      )}
    </div>
  );
}

type ReviewItem = {
  id: string;
  title: string;
  content: string;
  thumbnailImage: string | null;
  thumbnailSmall: string | null;
  thumbnailFirst: string | null;
  attachedFile: string | null;
  viewCount: number;
  createdAt: string;
  authorId: string;
  profileId: string;
  isAuthor: boolean;
};

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "0000.00.00";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function getContentCache(id: string): ReviewItem | null {
  try {
    const cached = sessionStorage.getItem(`user-review-content-${id}`);
    if (!cached) return null;
    const { data, ts } = JSON.parse(cached) as { data: ReviewItem; ts: number };
    if (Date.now() - ts < 60000 && data) return data;
  } catch {}
  return null;
}

export function UserContentPage({ id }: { id: string }) {
  const [item, setItem] = useState<ReviewItem | null>(() => getContentCache(id));
  const [notFound, setNotFound] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const originalCacheRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`/api/main/user-review/${id}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json() as Promise<ReviewItem>;
      })
      .then((data) => {
        if (data) {
          setItem(data);
          try {
            sessionStorage.setItem(`user-review-content-${id}`, JSON.stringify({ data, ts: Date.now() }));
          } catch {}
        }
      })
      .catch(() => { if (!item) setNotFound(true); });
  }, [id]);

  // 원본 URL 배열 (1024px)
  const originalImages: string[] = [];
  if (item?.thumbnailImage) {
    try {
      const parsed = JSON.parse(item.thumbnailImage);
      if (Array.isArray(parsed)) originalImages.push(...parsed);
      else originalImages.push(item.thumbnailImage);
    } catch {
      originalImages.push(item.thumbnailImage);
    }
  }

  // 중간 URL 배열 (480px)
  const mediumImages: string[] = [];
  if (item?.thumbnailSmall) {
    try {
      const parsed = JSON.parse(item.thumbnailSmall);
      if (Array.isArray(parsed)) mediumImages.push(...parsed);
    } catch {}
  }

  // 본문 표시용: 480px 우선
  const displayImages = originalImages.map((orig, i) => mediumImages[i] ?? orig);

  // 페이지 로드 후 1024px 원본 백그라운드 캐싱
  useEffect(() => {
    if (!item || originalImages.length === 0) return;
    const timer = setTimeout(() => {
      originalImages.forEach((src) => {
        if (originalCacheRef.current[src]) return;
        const img = new Image();
        img.onload = () => { originalCacheRef.current[src] = true; };
        img.src = src;
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [item]);

  const openViewer = useCallback((index: number) => {
    setViewerIndex(index);
  }, []);

  const closeViewer = useCallback(() => {
    setViewerIndex(null);
  }, []);

  let attachedFile: { name: string; type: string; data: string } | null = null;
  if (item?.attachedFile) {
    try {
      const parsed = JSON.parse(item.attachedFile);
      if (parsed && typeof parsed.name === "string" && typeof parsed.data === "string") {
        attachedFile = parsed;
      }
    } catch {}
  }

  return (
    <main className="landing-page">
      <UserContentHeader reviewId={id} isAuthor={item?.isAuthor ?? false} />
      <div className="landing-shell">
        {notFound ? (
          <section className="section stack">
            <h2>게시글을 찾을 수 없습니다</h2>
          </section>
        ) : !item ? (
          <div className="user-content-loading" />
        ) : (
          <>
            <article className="user-content-article">
              <h1 className="user-content-title">{item.title}</h1>
              <p className="user-content-meta muted">
                {item.authorId} · {formatDate(item.createdAt)} · 조회 {item.viewCount + 1}
              </p>
              {displayImages.map((src, i) => (
                <ContentImage key={i} src={src} index={i} onClickView={openViewer} />
              ))}
              {attachedFile && (
                <a
                  href={attachedFile.data}
                  download={attachedFile.name}
                  className="user-content-file-download"
                >
                  <span className="user-content-file-zip-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </span>
                  <span className="user-content-file-name">{attachedFile.name}</span>
                  <span className="user-content-file-dl-label">다운로드</span>
                </a>
              )}
              <p className="user-content-body">{item.content}</p>
            </article>
            <UserContentInteractions reviewId={id} />
          </>
        )}
      </div>

      {/* 1024px 원본 이미지 슬라이드 뷰어 */}
      {viewerIndex !== null && originalImages.length > 0 && (
        <ImageViewer
          images={originalImages}
          startIndex={viewerIndex}
          onClose={closeViewer}
        />
      )}
    </main>
  );
}
