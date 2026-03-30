"use client";

import { useState, useEffect, useRef } from "react";
import { GalleryHeroItem } from "@/components/gallery-hero-item";
import { GalleryCommentSheet } from "@/components/gallery-comment-sheet";
import { getCached, setCached } from "@/hooks/use-prefetch-cache";

type GalleryCardProps = {
  category: string;
  index: number;
  title: string;
  body: string;
  beforeImage: string;
  afterImage: string;
  caption?: string;
  aspectRatio?: string;
};

export function GalleryCard({
  category,
  index,
  title,
  body,
  beforeImage,
  afterImage,
  caption,
  aspectRatio,
}: GalleryCardProps) {
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [firstLiker, setFirstLiker] = useState<string | null>(null);
  const [commentCount, setCommentCount] = useState(0);
  const [commentSheetOpen, setCommentSheetOpen] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const cacheKey = `gallery_card_${category}_${index}`;

    function applyData(data: { count?: number; liked?: boolean; firstLiker?: string | null; commentCount?: number }) {
      setLikeCount(data.count ?? 0);
      setLiked(data.liked ?? false);
      setFirstLiker(data.firstLiker ?? null);
      setCommentCount(data.commentCount ?? 0);
    }

    // 캐시 히트 시 즉시 표시
    const cached = getCached<{ count: number; liked: boolean; firstLiker: string | null; commentCount: number }>(cacheKey);
    if (cached) {
      applyData(cached);
      return;
    }

    // Intersection Observer: 카드가 화면 300px 앞에 오면 fetch
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          observer.disconnect();
          // 좋아요 fetch
          fetch(`/api/gallery/${category}/${index}/likes`)
            .then((r) => r.json())
            .then((data) => applyData(data))
            .catch(() => {});
          // 댓글 미리 캐시 (댓글창 열면 즉시 표시)
          const commentKey = `gallery_comments_${category}_${index}`;
          if (!getCached(commentKey)) {
            fetch(`/api/gallery/${category}/${index}/comments`)
              .then((r) => r.json())
              .then((data) => setCached(commentKey, data))
              .catch(() => {});
          }
        }
      },
      { rootMargin: "300px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [category, index]);

  const handleLike = async () => {
    if (likeLoading) return;
    setLikeLoading(true);
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((prev) => (wasLiked ? Math.max(prev - 1, 0) : prev + 1));
    try {
      const res = await fetch(`/api/gallery/${category}/${index}/likes`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setLikeCount(data.count);
      } else {
        setLiked(wasLiked);
        setLikeCount((prev) => (wasLiked ? prev + 1 : Math.max(prev - 1, 0)));
      }
    } catch {
      setLiked(wasLiked);
      setLikeCount((prev) => (wasLiked ? prev + 1 : Math.max(prev - 1, 0)));
    } finally {
      setLikeLoading(false);
    }
  };

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title, url: window.location.href });
    }
  };

  const likeLabelNode =
    likeCount === 0 ? null : likeCount === 1 ? (
      <><strong>{firstLiker ?? "누군가"}</strong>님이 좋아합니다</>
    ) : (
      <><strong>{firstLiker ?? "누군가"}</strong>님 외 <strong>{likeCount - 1}명</strong>이 좋아합니다</>
    );

  const bodyLines = body ? body.split("\n") : [];

  return (
    <section className="gallery-section" ref={cardRef}>
      <h2 className="gallery-section-title">{title}</h2>
      <div className="gallery-image-block">
        <GalleryHeroItem
          beforeImage={beforeImage}
          afterImage={afterImage}
          label={title}
          aspectRatio={aspectRatio}
        />

        {/* 인터랙션 바 */}
        <div className="gallery-action-bar">
          <button
            className={`gallery-action-btn${likeCount >= 1 ? " gallery-liked" : ""}`}
            onClick={handleLike}
            disabled={likeLoading}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill={likeCount >= 1 ? "#FF2D2D" : "none"}
              stroke={likeCount >= 1 ? "#FF2D2D" : "currentColor"}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {likeCount > 0 && <span className="gallery-action-count">{likeCount}</span>}
          </button>

          <button className="gallery-action-btn" onClick={() => setCommentSheetOpen(true)}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {commentCount > 0 && <span className="gallery-action-count">{commentCount}</span>}
          </button>

          <button className="gallery-action-btn gallery-action-share" onClick={handleShare}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>

        {likeLabelNode && <p className="gallery-like-label">{likeLabelNode}</p>}

        {bodyLines.length > 0 && (
          <p className="gallery-card-body">
            {bodyLines.map((line, i) => (
              <span key={i}>
                {line}
                {i < bodyLines.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        )}

        {caption && <p className="gallery-caption">{caption}</p>}
      </div>

      {commentSheetOpen && (
        <GalleryCommentSheet
          category={category}
          index={index}
          onClose={() => setCommentSheetOpen(false)}
          onCommentAdded={() => setCommentCount((c) => c + 1)}
        />
      )}
    </section>
  );
}
