"use client";

import { useState, useEffect, useRef, type CSSProperties, type TouchEvent } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { GalleryHeroItem } from "@/components/gallery-hero-item";
import { GalleryCommentSheet } from "@/components/gallery-comment-sheet";
import { getCached, setCached } from "@/hooks/use-prefetch-cache";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type GalleryCardProps = {
  category: string;
  index: number;
  title: string;
  body: string;
  beforeImage: string;
  afterImage: string;
  caption?: string;
  aspectRatio?: string;
  autoOpenComments?: boolean;
  autoOpenLikes?: boolean;
  highlightCommentId?: string;
  openTimestamp?: string;
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
  autoOpenComments = false,
  autoOpenLikes = false,
  highlightCommentId,
  openTimestamp,
}: GalleryCardProps) {
  const { user, isSignedIn } = useUser();
  const router = useRouter();
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [firstLiker, setFirstLiker] = useState<string | null>(null);
  const [commentCount, setCommentCount] = useState(0);
  const [commentSheetOpen, setCommentSheetOpen] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [likeUsersSheetOpen, setLikeUsersSheetOpen] = useState(false);
  const [likeUsersSheetClosing, setLikeUsersSheetClosing] = useState(false);
  const [likeUsersSheetExpanded, setLikeUsersSheetExpanded] = useState(false);
  const [likeUsersSheetDragY, setLikeUsersSheetDragY] = useState(0);
  const [likeUsersLoading, setLikeUsersLoading] = useState(false);
  const [likeUsers, setLikeUsers] = useState<Array<{ profile_id: string; username: string | null; email: string | null; icon_image: string | null; created_at: string | null }>>([]);
  const [likeUsersSearch, setLikeUsersSearch] = useState("");
  const [profileCheckLoading, setProfileCheckLoading] = useState(false);
  const [usernamePromptOpen, setUsernamePromptOpen] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const userInteractedRef = useRef(false);
  const likeUsersSheetDraggingRef = useRef(false);
  const likeUsersSheetDragStartYRef = useRef(0);
  const cardCacheKey = `gallery_card_${category}_${index}_${user?.id ?? "guest"}`;
  const generalCacheKey = `general_${(user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? "guest").toLowerCase()}`;

  function maskEmail(email: string): string {
    const atIndex = email.indexOf("@");
    if (atIndex < 0) return email;
    const local = email.slice(0, atIndex);
    const domain = email.slice(atIndex);
    const visible = local.slice(0, 2);
    return `${visible}***${domain}`;
  }

  function formatJoinDate(value: string | null): string {
    if (!value) return "가입일 정보 없음";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "가입일 정보 없음";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `가입일 ${y}.${m}.${day}`;
  }

  useEffect(() => {
    if (autoOpenComments) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setCommentSheetOpen(true);
    }
  }, [autoOpenComments, openTimestamp]);

  useEffect(() => {
    if (autoOpenLikes) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setCommentSheetOpen(false);
      void openLikeUsersSheet();
    }
  }, [autoOpenLikes, openTimestamp]);

  useEffect(() => {
    if (!likeUsersSheetOpen) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [likeUsersSheetOpen]);

  useEffect(() => {
    function applyData(data: { count?: number; liked?: boolean; firstLiker?: string | null; commentCount?: number }) {
      setLikeCount(data.count ?? 0);
      setLiked(data.liked ?? false);
      setFirstLiker(data.firstLiker ?? null);
      setCommentCount(data.commentCount ?? 0);
    }

    // 캐시 히트 시 즉시 표시 (비로그인이면 liked 무시)
    const cached = getCached<{ count: number; liked: boolean; firstLiker: string | null; commentCount: number }>(cardCacheKey);
    if (cached) {
      applyData(isSignedIn ? cached : { ...cached, liked: false });
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
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error("likes fetch failed"))))
            .then((data) => {
              if (!userInteractedRef.current) {
                applyData(data);
                setCached(cardCacheKey, data);
              }
            })
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
  }, [category, index, isSignedIn, cardCacheKey]);

  // Supabase Realtime: 다른 사용자의 좋아요 변경 실시간 반영
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`gallery-likes-${category}-${index}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "gallery_item_likes",
          filter: `item_category=eq.${category}&item_index=eq.${index}`,
        },
        () => {
          if (!userInteractedRef.current) {
            fetch(`/api/gallery/${category}/${index}/likes`)
              .then((r) => (r.ok ? r.json() : Promise.reject(new Error("likes fetch failed"))))
              .then((data) => {
                if (!userInteractedRef.current) {
                  setLikeCount(data.count ?? 0);
                  setFirstLiker(data.firstLiker ?? null);
                }
              })
              .catch(() => {});
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [category, index]);

  const handleLike = async () => {
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }
    if (likeLoading) return;
    userInteractedRef.current = true;
    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 450);
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
        // 캐시 업데이트 → 페이지 재방문 시 liked 상태 유지
        const cached = getCached<{ count: number; liked: boolean; firstLiker: string | null; commentCount: number }>(cardCacheKey);
        if (cached) {
          setCached(cardCacheKey, { ...cached, liked: data.liked, count: data.count });
        }
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

  const dismissLikeUsersSheet = () => {
    if (likeUsersSheetClosing) return;
    setLikeUsersSheetDragY(0);
    setLikeUsersSheetClosing(true);
    setTimeout(() => {
      setLikeUsersSheetOpen(false);
      setLikeUsersSearch("");
      setLikeUsersSheetClosing(false);
      setLikeUsersSheetExpanded(false);
    }, 300);
  };

  const openLikeUsersSheet = async () => {
    setLikeUsersSheetClosing(false);
    setLikeUsersSheetExpanded(false);
    setLikeUsersSheetDragY(0);
    setLikeUsersSheetOpen(true);
    if (likeUsers.length > 0) return;
    setLikeUsersLoading(true);
    try {
      const res = await fetch(`/api/gallery/${category}/${index}/likes/users`);
      if (res.ok) {
        const data = await res.json();
        const users = Array.isArray(data.users) ? data.users : [];
        setLikeUsers(users.slice(1));
      }
    } catch {
      setLikeUsers([]);
    } finally {
      setLikeUsersLoading(false);
    }
  };

  function onLikeUsersSheetDragStart(e: TouchEvent) {
    likeUsersSheetDraggingRef.current = true;
    likeUsersSheetDragStartYRef.current = e.touches[0].clientY;
  }

  function onLikeUsersSheetDragMove(e: TouchEvent) {
    if (!likeUsersSheetDraggingRef.current) return;
    const diff = e.touches[0].clientY - likeUsersSheetDragStartYRef.current;
    if (likeUsersSheetExpanded) {
      if (diff > 0) setLikeUsersSheetDragY(diff);
    } else {
      setLikeUsersSheetDragY(diff);
    }
  }

  function onLikeUsersSheetDragEnd() {
    likeUsersSheetDraggingRef.current = false;
    if (likeUsersSheetExpanded) {
      if (likeUsersSheetDragY > 100) setLikeUsersSheetExpanded(false);
      setLikeUsersSheetDragY(0);
      return;
    }

    if (likeUsersSheetDragY < -60) {
      setLikeUsersSheetExpanded(true);
      setLikeUsersSheetDragY(0);
      return;
    }

    if (likeUsersSheetDragY > 80) {
      dismissLikeUsersSheet();
      return;
    }

    setLikeUsersSheetDragY(0);
  }

  const openUserProfilePage = async (profileId: string, username: string | null) => {
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    setProfileCheckLoading(true);
    try {
      const cachedGeneral = getCached<{ username?: string | null }>(generalCacheKey);
      let myUsername = cachedGeneral?.username ?? null;

      if (myUsername === null) {
        const res = await fetch("/api/account/general");
        if (res.ok) {
          const generalData = await res.json();
          setCached(generalCacheKey, generalData);
          myUsername = generalData?.username ?? null;
        }
      }

      if (!myUsername) {
        setUsernamePromptOpen(true);
        return;
      }

      const params = new URLSearchParams({ profileId });
      if (username) params.set("username", username);
      params.set("category", category);
      params.set("index", String(index));
      params.set("likesSheet", "1");
      router.push(`/account/userpage?${params.toString()}`);
    } catch {
      setUsernamePromptOpen(true);
    } finally {
      setProfileCheckLoading(false);
    }
  };

  const likeLabelNode =
    likeCount === 0 ? null : likeCount === 1 ? (
      <><strong>{firstLiker ?? "누군가"}</strong>님이 좋아합니다</>
    ) : (
      <>
        <strong>{firstLiker ?? "누군가"}</strong>님 외{" "}
        <button type="button" className="gallery-like-count-btn" onClick={() => void openLikeUsersSheet()}>
          <strong>{likeCount - 1}명</strong>
        </button>
        이 좋아합니다
      </>
    );

  const bodyLines = body ? body.split("\n") : [];
  const filteredLikeUsers = likeUsers.filter((u) => {
    const q = likeUsersSearch.trim().toLowerCase();
    if (!q) return true;
    const name = (u.username ?? "").toLowerCase();
    const email = (u.email ?? "").toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  const likeUsersPanelStyle: CSSProperties = {
    height: likeUsersSheetExpanded ? "100dvh" : "70vh",
    borderRadius: likeUsersSheetExpanded ? "0" : "20px 20px 0 0",
    transform: likeUsersSheetClosing
      ? "translateY(100%)"
      : likeUsersSheetDragY > 0
        ? `translateY(${likeUsersSheetDragY}px)`
        : undefined,
    transition: likeUsersSheetDraggingRef.current
      ? "none"
      : likeUsersSheetClosing
        ? "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)"
        : "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), height 0.3s cubic-bezier(0.32, 0.72, 0, 1), border-radius 0.3s",
  };

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
            className={`gallery-action-btn${liked ? " gallery-liked" : ""}${likeAnimating ? " heart-animate" : ""}`}
            onClick={handleLike}
            disabled={likeLoading}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill={liked ? "#FF2D2D" : "none"}
              stroke={liked ? "#FF2D2D" : "currentColor"}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
          {likeCount > 0 && (
            <span className="gallery-action-count gallery-action-like-count">{likeCount}</span>
          )}

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
          onClose={() => {
            setCommentSheetOpen(false);
            // 시트 닫을 때 URL에서 commentId 제거 — 재오픈 시 highlight 방지
            const url = new URL(window.location.href);
            if (url.searchParams.has("commentId")) {
              url.searchParams.delete("commentId");
              url.searchParams.delete("t");
              router.replace(url.pathname + (url.search || ""), { scroll: false });
            }
          }}
          onCommentAdded={() => {
            setCommentCount((c) => c + 1);
            const cached = getCached<{ count: number; liked: boolean; firstLiker: string | null; commentCount: number }>(cardCacheKey);
            if (cached) {
              setCached(cardCacheKey, { ...cached, commentCount: cached.commentCount + 1 });
            }
          }}
          onCommentDeleted={(deletedCount) => {
            setCommentCount((c) => Math.max(c - deletedCount, 0));
            const cached = getCached<{ count: number; liked: boolean; firstLiker: string | null; commentCount: number }>(cardCacheKey);
            if (cached) {
              setCached(cardCacheKey, {
                ...cached,
                commentCount: Math.max((cached.commentCount ?? 0) - deletedCount, 0),
              });
            }
          }}
          highlightCommentId={highlightCommentId}
        />
      )}

      {likeUsersSheetOpen && (
        <div className={`gallery-sheet-overlay${likeUsersSheetClosing ? " is-closing" : ""}`} onClick={dismissLikeUsersSheet}>
          <div className="gallery-sheet-panel gallery-like-sheet-panel" style={likeUsersPanelStyle} onClick={(e) => e.stopPropagation()}>
            <div
              className="gallery-sheet-drag-area"
              onTouchStart={onLikeUsersSheetDragStart}
              onTouchMove={onLikeUsersSheetDragMove}
              onTouchEnd={onLikeUsersSheetDragEnd}
            >
              <div className="gallery-sheet-handle" />
              <p className="gallery-sheet-title">좋아요</p>
            </div>
            <div className="gallery-like-sheet-list">
              <div className="gallery-like-sheet-search-wrap">
                <input
                  type="text"
                  className="gallery-like-sheet-search"
                  placeholder="아이디 또는 이메일 검색"
                  value={likeUsersSearch}
                  onChange={(e) => setLikeUsersSearch(e.target.value)}
                />
              </div>
              {likeUsersLoading ? (
                <p className="gallery-sheet-empty">불러오는 중...</p>
              ) : filteredLikeUsers.length === 0 ? (
                <p className="gallery-sheet-empty">표시할 사용자가 없습니다</p>
              ) : (
                filteredLikeUsers.map((u, i) => (
                  <div key={`${u.username ?? u.email ?? "user"}-${i}`} className="gallery-like-sheet-row">
                      <div className="gallery-like-sheet-left">
                        {u.icon_image ? (
                          <img src={u.icon_image} alt="" className="gallery-like-sheet-avatar" />
                        ) : (
                          <div className="gallery-like-sheet-avatar gallery-like-user-avatar-default" />
                        )}
                        <div className="gallery-like-sheet-user-meta">
                          <p className="gallery-like-sheet-user-name">{u.username ?? (u.email ? maskEmail(u.email) : "익명")}</p>
                          <p className="gallery-like-sheet-user-joined">{formatJoinDate(u.created_at)}</p>
                        </div>
                      </div>
                    <button
                      type="button"
                      className="gallery-like-sheet-profile-open-btn"
                      onClick={() => {
                        if (!u.profile_id) return;
                        void openUserProfilePage(u.profile_id, u.username);
                      }}
                      disabled={profileCheckLoading}
                    >
                      사용자프로파일
                    </button>
                  </div>
                ))
              )}
            </div>

            {usernamePromptOpen && (
              <div className="gallery-inline-modal-overlay" onClick={(e) => e.stopPropagation()}>
                <div className="gallery-inline-modal" onClick={(e) => e.stopPropagation()}>
                  <p className="gallery-inline-modal-text">아이디 등록후 사용할수 있습니다.</p>
                  <div className="gallery-inline-modal-actions">
                    <button
                      type="button"
                      className="gallery-inline-modal-btn gallery-inline-modal-btn-cancel"
                      onClick={() => setUsernamePromptOpen(false)}
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      className="gallery-inline-modal-btn gallery-inline-modal-btn-ok"
                      onClick={() => {
                        setUsernamePromptOpen(false);
                        router.push("/account/general");
                      }}
                    >
                      확인
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
