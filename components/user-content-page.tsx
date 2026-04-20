"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { createPortal } from "react-dom";
import { UserContentHeader } from "@/components/user-content-header";
import { UserContentInteractions, UserContentLikeSection } from "@/components/user-content-interactions";
import { CommentSheetFrame } from "@/components/comment-sheet-frame";
import { UserProfileModal, type UserProfileModalTarget } from "@/components/user-profile-modal";

function ContentImage({
  src,
  index,
  isUpgraded,
  onClickView,
}: {
  src: string;
  index: number;
  isUpgraded: boolean;
  onClickView: (index: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <button
      type="button"
      className={`user-content-thumb-btn${isUpgraded ? " is-upgraded" : ""}`}
      onClick={() => onClickView(index)}
    >
      <img
        src={src}
        alt=""
        className={`user-content-thumb${isUpgraded ? " is-upgraded" : ""}`}
        style={{ opacity: loaded ? 1 : 0 }}
        onLoad={() => setLoaded(true)}
      />
    </button>
  );
}

function getDistance(t1: React.Touch, t2: React.Touch) {
  return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
}

function getMidpoint(t1: React.Touch, t2: React.Touch) {
  return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
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
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [current, setCurrent] = useState(startIndex);
  const [showUI, setShowUI] = useState(true);
  const [loadedSet, setLoadedSet] = useState<Set<number>>(() => new Set());
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [slideDuration, setSlideDuration] = useState(0.35);
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 줌 상태
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const isPinching = useRef(false);

  const total = images.length;
  const hasPrev = current > 0;
  const hasNext = current < total - 1;
  const isZoomed = scale > 1.05;

  // 이미지 전환 시 줌 리셋
  useEffect(() => {
    setScale(1);
    setPanX(0);
    setPanY(0);
  }, [current]);

  useEffect(() => {
    setPortalTarget(document.body);
    return () => setPortalTarget(null);
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev && !isZoomed) setCurrent((c) => c - 1);
      if (e.key === "ArrowRight" && hasNext && !isZoomed) setCurrent((c) => c + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasPrev, hasNext, onClose, isZoomed]);

  function handleTouchStart(e: React.TouchEvent) {
    // 핀치 시작 (두 손가락)
    if (e.touches.length === 2) {
      isPinching.current = true;
      pinchRef.current = {
        dist: getDistance(e.touches[0], e.touches[1]),
        scale,
      };
      touchStartRef.current = null;
      setIsDragging(false);
      return;
    }

    // 한 손가락
    const t = e.touches[0];
    if (isZoomed) {
      // 줌 상태: 팬 시작
      panStartRef.current = { x: t.clientX, y: t.clientY, panX, panY };
    } else {
      // 기본: 슬라이드 스와이프
      touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
      setIsDragging(true);
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    // 핀치 줌
    if (e.touches.length === 2 && pinchRef.current) {
      const newDist = getDistance(e.touches[0], e.touches[1]);
      const ratio = newDist / pinchRef.current.dist;
      const newScale = Math.min(Math.max(pinchRef.current.scale * ratio, 1), 2);
      setScale(newScale);
      if (newScale <= 1.05) { setPanX(0); setPanY(0); }
      return;
    }

    // 줌 상태: 팬 이동
    if (isZoomed && panStartRef.current && e.touches.length === 1) {
      const t = e.touches[0];
      setPanX(panStartRef.current.panX + t.clientX - panStartRef.current.x);
      setPanY(panStartRef.current.panY + t.clientY - panStartRef.current.y);
      return;
    }

    // 기본: 슬라이드 드래그
    if (!touchStartRef.current) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    if ((!hasPrev && dx > 0) || (!hasNext && dx < 0)) {
      setDragX(dx * 0.3);
    } else {
      setDragX(dx);
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    // 핀치 종료
    if (isPinching.current) {
      isPinching.current = false;
      pinchRef.current = null;
      // 줌이 1에 가까우면 리셋
      if (scale <= 1.05) {
        setScale(1);
        setPanX(0);
        setPanY(0);
      }
      return;
    }

    // 줌 팬 종료
    if (isZoomed) {
      panStartRef.current = null;
      return;
    }

    // 기본: 슬라이드 스와이프 종료
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.t;
    touchStartRef.current = null;
    setIsDragging(false);
    setDragX(0);

    // 탭 → 카운터만 토글 (X 버튼은 항상 표시)
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20 && dt < 300) {
      const target = e.target as HTMLElement;
      if (!target.closest(".user-content-viewer-close") && !target.closest(".user-content-viewer-arrow") && !target.closest(".user-content-viewer-download")) {
        setShowUI((v) => !v);
      }
      return;
    }

    // 스와이프
    const velocity = Math.abs(dx) / dt;
    if ((Math.abs(dx) > 50 || velocity > 0.3) && Math.abs(dx) > Math.abs(dy)) {
      // 속도 비례 전환: 빠를수록 짧게 (0.2s~0.35s)
      const duration = Math.max(0.25, Math.min(0.5, 0.7 - velocity * 0.35));
      setSlideDuration(duration);
      if (dx < 0 && hasNext) setCurrent((c) => c + 1);
      if (dx > 0 && hasPrev) setCurrent((c) => c - 1);
    }
  }

  // 더블탭 줌 토글
  const lastTapRef = useRef(0);
  function handleDoubleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest(".user-content-viewer-close") || target.closest(".user-content-viewer-arrow") || target.closest(".user-content-viewer-download")) return;

    if (isZoomed) {
      setScale(1);
      setPanX(0);
      setPanY(0);
    } else {
      setScale(1.5);
      // 클릭한 위치를 중심으로 줌
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const cx = e.clientX - rect.left - rect.width / 2;
        const cy = e.clientY - rect.top - rect.height / 2;
        setPanX(-cx * 0.5);
        setPanY(-cy * 0.5);
      }
    }
  }

  function handleImageLoaded(index: number) {
    setLoadedSet((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }

  const trackStyle: React.CSSProperties = {
    display: "flex",
    width: "100%",
    height: "100%",
    flexShrink: 0,
    transform: `translateX(calc(${-current * 100}vw + ${dragX}px))`,
    transition: isDragging ? "none" : `transform ${slideDuration}s cubic-bezier(0.4, 0.9, 0.3, 1)`,
  };

  const imageTransform = `scale(${scale}) translate(${panX / scale}px, ${panY / scale}px)`;
  const imageTransition = isPinching.current || panStartRef.current ? "none" : "transform 0.25s ease-out";

  const viewerNode = (
    <div
      ref={containerRef}
      className="user-content-viewer-overlay"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
    >
      <button
        type="button"
        className="user-content-viewer-download"
        aria-label="다운로드"
        onClick={(e) => {
          e.stopPropagation();
          const url = images[current];
          const ext = url.split(".").pop()?.split("?")[0] ?? "jpg";
          const fileName = `image_1024_${current + 1}.${ext}`;
          fetch(url)
            .then((r) => r.blob())
            .then(async (blob) => {
              const file = new File([blob], fileName, { type: blob.type });
              if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
                try {
                  await navigator.share({ files: [file] });
                  return;
                } catch {}
              }
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = fileName;
              a.click();
              URL.revokeObjectURL(a.href);
            })
            .catch(() => window.open(url, "_blank"));
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>
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

      {showUI && total > 1 && (
        <div className="user-content-viewer-counter">
          {current + 1} / {total}
        </div>
      )}

      {/* 슬라이드 트랙 */}
      <div style={trackStyle}>
        {images.map((src, i) => (
          <div key={i} className="user-content-viewer-wrap" style={{ width: "100vw", flexShrink: 0 }}>
            {Math.abs(i - current) <= 1 && (
              <>
                {!loadedSet.has(i) && <div className="user-content-viewer-spinner" />}
                <img
                  src={src}
                  alt=""
                  className="user-content-viewer-img"
                  style={{
                    opacity: loadedSet.has(i) ? 1 : 0,
                    transform: i === current ? imageTransform : undefined,
                    transition: i === current ? `opacity 0.2s, ${imageTransition}` : "opacity 0.2s",
                  }}
                  onLoad={() => handleImageLoaded(i)}
                />
              </>
            )}
          </div>
        ))}
      </div>

      {showUI && !isZoomed && hasPrev && (
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
      {showUI && !isZoomed && hasNext && (
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

  if (!portalTarget) return null;
  return createPortal(viewerNode, portalTarget);
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
  authorEmail?: string | null;
  authorIconImage?: string | null;
  authorTier?: string | null;
  profileId: string;
  isAuthor: boolean;
  board?: string;
  isPinned?: boolean;
  isGlobalPinned?: boolean;
};

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "0000.00.00 00:00:00";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const sec = String(d.getSeconds()).padStart(2, "0");
  return `${y}.${m}.${day} ${h}:${min}:${sec}`;
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

const BOARD_VALUES = new Set(["notice", "review", "qna", "arao"]);

function getNormalizedBoard(board?: string | null): string {
  if (!board) return "review";
  return BOARD_VALUES.has(board) ? board : "review";
}

function getBoardListPath(board: string): string {
  return board === "review" ? "/user_review" : `/user_review?board=${board}`;
}

export function UserContentPage({
  id,
  onRequestClose,
  onReviewCountsChange,
}: {
  id: string;
  onRequestClose?: () => void;
  onReviewCountsChange?: (next: { reviewId: string; likeCount?: number; commentCount?: number }) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, user } = useUser();
  const [item, setItem] = useState<ReviewItem | null>(null);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [profileModalTarget, setProfileModalTarget] = useState<UserProfileModalTarget | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [commentSheetOpen, setCommentSheetOpen] = useState(false);
  const [justSubmittedCommentId, setJustSubmittedCommentId] = useState<string | null>(null);
  const [liveCommentCount, setLiveCommentCount] = useState<number>(0);
  const [pendingReplyTarget, setPendingReplyTarget] = useState<{ authorId: string; commentId: string; parentId: string } | null>(null);
  const originalCacheRef = useRef<Record<string, boolean>>({});
  const [upgradedImages, setUpgradedImages] = useState<Record<number, string>>({});
  const routeBoard = searchParams.get("board");
  const routeCommentId = searchParams.get("commentId");
  const routeSource = searchParams.get("from");
  const normalizedBoard = getNormalizedBoard(routeBoard ?? item?.board ?? null);
  const boardListPath = getBoardListPath(normalizedBoard);
  const cameFromNotification = routeSource === "notification";
  const targetCommentId = routeCommentId && routeCommentId.trim().length > 0 ? routeCommentId : null;
  const signedInEmail =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    null;

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user-review-read-ids");
      const parsed = stored ? (JSON.parse(stored) as string[]) : [];
      const next = Array.isArray(parsed) ? parsed : [];
      if (!next.includes(id)) {
        next.push(id);
        localStorage.setItem("user-review-read-ids", JSON.stringify(next));
      }
    } catch {}
    void fetch(`/api/main/user-review/${id}/views`, { method: "POST" }).catch(() => {});
  }, [id]);

  const closeWithSlide = useCallback(() => {
    if (cameFromNotification) {
      try {
        sessionStorage.setItem("header-notification-reopen-once", "1");
      } catch {}
    }
    if (onRequestClose) {
      onRequestClose();
      return;
    }
    router.push(boardListPath, { scroll: false });
  }, [onRequestClose, router, boardListPath, cameFromNotification]);

  function openCommentSheet(replyTarget?: { authorId: string; commentId: string; parentId: string }) {
    if (!isSignedIn) { router.push("/sign-in"); return; }
    setPendingReplyTarget(replyTarget ?? null);
    setCommentSheetOpen(true);
  }

  function handleCommentSheetButtonClick() {
    openCommentSheet();
  }

  function closeCommentSheet() {
    setCommentSheetOpen(false);
    setPendingReplyTarget(null);
  }

  useEffect(() => {
    let cancelled = false;

    if (!isSignedIn) {
      setViewerRole(null);
      return () => {
        cancelled = true;
      };
    }

    try {
      if (signedInEmail) {
        const cacheKey = `general_${signedInEmail.toLowerCase()}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as { data?: { role?: string } };
          const cachedRole = parsed?.data?.role;
          if (typeof cachedRole === "string" && cachedRole.trim().length > 0) {
            setViewerRole(cachedRole);
          }
        }
      }
    } catch {}

    fetch("/api/account/general")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { role?: string } | null) => {
        if (cancelled) return;
        setViewerRole(data?.role ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setViewerRole(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, signedInEmail]);

  // 1단계: 마운트 후 캐시 데이터로 즉시 채우기
  useEffect(() => {
    const cached = getContentCache(id);
    if (cached) setItem(cached);
  }, [id]);

  // 2단계: 서버에서 최신 데이터 가져오기
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/main/user-review/${id}`)
      .then((r) => {
        if (!r.ok) {
          if (r.status === 404) setNotFound(true);
          return null;
        }
        return r.json() as Promise<ReviewItem>;
      })
      .then((data) => {
        if (!data || cancelled) return;
        setNotFound(false);
        setItem(data);
        try {
          sessionStorage.setItem(`user-review-content-${id}`, JSON.stringify({ data, ts: Date.now() }));
        } catch {}
      })
      .catch(() => {
        if (cancelled) return;
        const cached = getContentCache(id);
        if (!cached) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
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
  const mediumImages: Array<string | null> = [];
  if (item?.thumbnailSmall) {
    try {
      const parsed = JSON.parse(item.thumbnailSmall);
      if (Array.isArray(parsed)) mediumImages.push(...parsed.map((v) => (typeof v === "string" ? v : null)));
    } catch {}
  }

  // 본문 표시용: 1024px 로드 완료 시 교체, 아니면 480px 우선
  const displayImages = originalImages.map((orig, i) => upgradedImages[i] ?? mediumImages[i] ?? orig);

  // 페이지 로드 후 1024px 원본 백그라운드 로드 → 완료 시 본문 이미지 교체
  useEffect(() => {
    if (!item || originalImages.length === 0) return;
    const timer = setTimeout(() => {
      originalImages.forEach((src, i) => {
        if (originalCacheRef.current[src]) {
          setUpgradedImages((prev) => ({ ...prev, [i]: src }));
          return;
        }
        const img = new Image();
        img.onload = () => {
          originalCacheRef.current[src] = true;
          setUpgradedImages((prev) => ({ ...prev, [i]: src }));
        };
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

  function handleAuthorAvatarClick() {
    if (!item) return;
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    setProfileModalTarget({
      authorId: item.authorId,
      authorEmail: item.authorEmail ?? null,
      authorTier: item.authorTier ?? null,
      iconImage: item.authorIconImage ?? null,
    });
  }

  let attachedFile: { name: string; type: string; url?: string; data?: string } | null = null;
  if (item?.attachedFile) {
    try {
      const parsed = JSON.parse(item.attachedFile);
      if (parsed && typeof parsed.name === "string") {
        const next: { name: string; type: string; url?: string; data?: string } = {
          name: parsed.name,
          type: typeof parsed.type === "string" ? parsed.type : "",
        };
        if (typeof parsed.url === "string") next.url = parsed.url;
        if (typeof parsed.data === "string") next.data = parsed.data;
        if (next.url || next.data) attachedFile = next;
      }
    } catch {}
  }

  return (
    <main className="landing-page user-content-page user-content-page-shell">
      <UserContentHeader reviewId={id} isAuthor={item?.isAuthor ?? false} board={item?.board} onBack={closeWithSlide} />
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
              <h1 className="user-content-title">
                {(item.isPinned || item.isGlobalPinned) && (
                  <span className={`user-review-pin-badge${item.isGlobalPinned ? " is-global" : ""}`}>
                    {item.isGlobalPinned ? "필독" : "공지"}
                  </span>
                )}
                {item.title}
              </h1>
              <div className="user-content-author-row">
                <button
                  type="button"
                  className="user-content-author-avatar-btn"
                  onClick={handleAuthorAvatarClick}
                  aria-label={`${item.authorId} 회원 정보 보기`}
                >
                  <span className="user-content-author-avatar">
                    {item.authorIconImage ? (
                      <img src={item.authorIconImage} alt="" className="user-content-author-avatar-img" />
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 20c0-4.2 3.6-7 8-7s8 2.8 8 7" />
                      </svg>
                    )}
                  </span>
                </button>
                <div className="user-content-author-meta">
                  <p className="user-content-author-id">{item.authorId}</p>
                  <p className="user-content-author-date-line muted">
                    <span className="user-content-author-date">{formatDate(item.createdAt)}</span>
                    <span className="user-content-author-views">조회 {item.viewCount}</span>
                  </p>
                </div>
              </div>
              <div className="user-content-body-divider" aria-hidden="true" />
              {normalizedBoard === "arao" && displayImages.length > 0 && (
                <div className="user-content-arao-meta">
                  <span>카메라 : Nikon ZF</span>
                  <span className="user-content-arao-meta-sep">/</span>
                  <a href="/gallery" className="user-content-arao-meta-badge">
                    프로파일 : ARAO
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                  <span className="user-content-arao-meta-sep">/</span>
                  <span>수정편집 : JPEG 원본</span>
                </div>
              )}
              {displayImages.map((src, i) => (
                <ContentImage
                  key={i}
                  src={src}
                  index={i}
                  isUpgraded={Boolean(upgradedImages[i] || !mediumImages[i])}
                  onClickView={openViewer}
                />
              ))}
              {attachedFile && (
                <button
                  type="button"
                  className="user-content-file-download"
                  onClick={() => {
                    const sourceUrl = attachedFile.url ?? attachedFile.data;
                    if (!sourceUrl) return;
                    fetch(sourceUrl)
                      .then((r) => r.blob())
                      .then(async (blob) => {
                        const file = new File([blob], attachedFile.name, { type: blob.type || attachedFile.type });
                        if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
                          try {
                            await navigator.share({ files: [file] });
                            return;
                          } catch {}
                        }
                        const a = document.createElement("a");
                        a.href = URL.createObjectURL(blob);
                        a.download = attachedFile.name;
                        a.click();
                        URL.revokeObjectURL(a.href);
                      })
                      .catch(() => {
                        const a = document.createElement("a");
                        a.href = sourceUrl;
                        a.download = attachedFile.name;
                        a.rel = "noopener";
                        a.target = "_blank";
                        a.click();
                      });
                  }}
                >
                  <span className="user-content-file-zip-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </span>
                  <span className="user-content-file-name">{attachedFile.name}</span>
                </button>
              )}
              <p className="user-content-body">{item.content}</p>
              <UserContentLikeSection
                reviewId={id}
                onLikeCountChange={(nextLikeCount) => {
                  onReviewCountsChange?.({ reviewId: id, likeCount: nextLikeCount });
                }}
              />
            </article>
            <UserContentInteractions
              reviewId={id}
              reviewAuthorId={item.authorId}
              targetCommentId={justSubmittedCommentId ?? targetCommentId}
              onCommentCountChange={(nextCommentCount) => {
                setLiveCommentCount(nextCommentCount);
                onReviewCountsChange?.({ reviewId: id, commentCount: nextCommentCount });
              }}
              onRequestOpenSheet={openCommentSheet}
            />
            <div className="user-content-bottom-footer">
              <div className="user-content-bottom-footer-inner">
              <button type="button" className="user-content-bottom-back-btn" onClick={closeWithSlide} aria-label="목록으로">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <UserContentLikeSection
                reviewId={id}
                footer
                onLikeCountChange={(nextLikeCount) => {
                  onReviewCountsChange?.({ reviewId: id, likeCount: nextLikeCount });
                }}
              />
              <button type="button" className="user-content-bottom-comment-btn" aria-label="댓글" onClick={handleCommentSheetButtonClick}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </button>
              <button type="button" className="user-content-bottom-more-btn" aria-label="더보기">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" />
                </svg>
              </button>
              </div>
            </div>

            {/* 댓글 시트 */}
            {commentSheetOpen && (
              <CommentSheetFrame
                title="댓글"
                count={liveCommentCount}
                onClose={closeCommentSheet}
                collapsedHeight="100dvh"
                expandedHeight="100dvh"
                collapsedBorderRadius="0"
                expandedBorderRadius="0"
              >
                <div className="gallery-sheet-comments" style={{ overflowY: "auto", flex: 1 }}>
                  <UserContentInteractions
                    reviewId={id}
                    reviewAuthorId={item.authorId}
                    targetCommentId={targetCommentId}
                    onCommentCountChange={(nextCommentCount) => {
                      onReviewCountsChange?.({ reviewId: id, commentCount: nextCommentCount });
                    }}
                    autoFocusComment
                    initialReplyTarget={pendingReplyTarget}
                  />
                </div>
              </CommentSheetFrame>
            )}

            <UserProfileModal
              target={profileModalTarget}
              isSignedIn={!!isSignedIn}
              viewerRole={viewerRole}
              onRequestSignIn={() => router.push("/sign-in")}
              onClose={() => setProfileModalTarget(null)}
            />
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
