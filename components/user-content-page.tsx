"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { UserContentHeader } from "@/components/user-content-header";
import { UserContentInteractions } from "@/components/user-content-interactions";

function ContentImage({
  src,
  thumbnail,
  originalSrc,
  onClickView,
}: {
  src: string;
  thumbnail?: string;
  originalSrc?: string;
  onClickView: (src: string) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <button
      type="button"
      className="user-content-thumb-btn"
      onClick={() => onClickView(originalSrc ?? src)}
    >
      {thumbnail && !loaded && (
        <img src={thumbnail} alt="" className="user-content-thumb user-content-thumb-blur" />
      )}
      <img
        src={src}
        alt=""
        className="user-content-thumb"
        style={{ display: loaded ? "block" : "none" }}
        onLoad={() => setLoaded(true)}
      />
    </button>
  );
}

type ReviewItem = {
  id: string;
  title: string;
  content: string;
  thumbnailImage: string | null;   // 원본 URL 배열 (1024px)
  thumbnailSmall: string | null;   // 중간 URL 배열 (480px, 앞 3장)
  thumbnailFirst: string | null;   // 썸네일 URL (200px, 리스트용)
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
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [isLandscape, setIsLandscape] = useState(false);
  const [viewerLoaded, setViewerLoaded] = useState(false);
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

  // 본문 표시용 이미지: 480px 우선, 없으면 원본
  const displayImages = originalImages.map((orig, i) => ({
    display: mediumImages[i] ?? orig,
    thumbnail: i < 3 && mediumImages[i] ? undefined : undefined,
    original: orig,
  }));

  // 페이지 로드 완료 후 1024px 원본 백그라운드 캐싱
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

  // 이미지 클릭 → 1024px 뷰어
  const openViewer = useCallback((src: string) => {
    setViewerLoaded(false);
    setIsLandscape(false);
    setViewerSrc(src);
    document.body.style.overflow = "hidden";
  }, []);

  const closeViewer = useCallback(() => {
    setViewerSrc(null);
    setViewerLoaded(false);
    document.body.style.overflow = "";
  }, []);

  // 뷰어 이미지 로드 시 가로/세로 판단
  const handleViewerLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setIsLandscape(img.naturalWidth > img.naturalHeight);
    setViewerLoaded(true);
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
              {displayImages.map((img, i) => (
                <ContentImage
                  key={i}
                  src={img.display}
                  originalSrc={img.original}
                  onClickView={openViewer}
                />
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

      {/* 1024px 원본 이미지 뷰어 */}
      {viewerSrc && (
        <div className="user-content-viewer-overlay" onClick={closeViewer}>
          <div className="user-content-viewer-wrap">
            {!viewerLoaded && <div className="user-content-viewer-spinner" />}
            <img
              src={viewerSrc}
              alt=""
              className={`user-content-viewer-img${isLandscape ? " landscape" : ""}`}
              style={{ opacity: viewerLoaded ? 1 : 0 }}
              onLoad={handleViewerLoad}
            />
          </div>
        </div>
      )}
    </main>
  );
}
