"use client";

import { useState, useEffect, useRef, type CSSProperties, type TouchEvent } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import type { GalleryComment } from "@/lib/gallery-interactions";
import { getCached, setCached } from "@/hooks/use-prefetch-cache";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { buildSignInHrefFromCurrentLocation } from "@/lib/auth-redirect";

function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex < 0) return email;
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  return local.slice(0, 2) + "***" + domain;
}

function formatCommentRelativeTime(isoString: string, nowMs: number): string {
  const then = new Date(isoString).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Math.max(nowMs - then, 0);

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}초전`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분전`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간전`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일전`;

  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks}주일전`;
  }

  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months}개월전`;
  }

  const years = Math.floor(days / 365);
  return `${years}년전`;
}

type Props = {
  category: string;
  index: number;
  onClose: () => void;
  onCommentAdded: () => void;
  onCommentDeleted?: (deletedCount: number) => void;
  highlightCommentId?: string;
};

type ReplyContext = {
  target: GalleryComment;
  parentId: string;
};

const ROOT_SOFT_DELETE_BLIND_TEXT = "해당 댓글이 삭제되었습니다";

export function GalleryCommentSheet({ category, index, onClose, onCommentAdded, onCommentDeleted, highlightCommentId }: Props) {
  const { user, isSignedIn } = useUser();
  const router = useRouter();
  const [comments, setComments] = useState<GalleryComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [commentLikes, setCommentLikes] = useState<Record<string, { liked: boolean; count: number }>>({});
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyContext | null>(null);
  const [dragY, setDragY] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const highlightRef = useRef<HTMLDivElement>(null);
  const commentsRef = useRef<GalleryComment[]>([]);
  const myEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;

  // 시트가 열려 있는 동안 배경 페이지 스크롤 잠금
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  // commentsRef를 항상 최신 상태로 유지 (Realtime 핸들러에서 사용)
  useEffect(() => { commentsRef.current = comments; }, [comments]);

  // 상대시간 표시 갱신
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!deleteConfirmId) return;
    if (!comments.some((c) => c.id === deleteConfirmId)) {
      setDeleteConfirmId(null);
    }
  }, [comments, deleteConfirmId]);

  useEffect(() => {
    const commentKey = `gallery_comments_${category}_${index}`;

    function applyComments(data: { comments?: (GalleryComment & { user_liked?: boolean })[] }) {
      const list = data.comments ?? [];
      setComments(list);
      const likes: Record<string, { liked: boolean; count: number }> = {};
      list.forEach((c) => { likes[c.id] = { liked: c.user_liked ?? false, count: c.like_count }; });
      setCommentLikes(likes);
      setLoading(false);
    }

    // 캐시 히트 시 즉시 댓글 표시
    const cached = getCached<{ comments: (GalleryComment & { user_liked?: boolean })[] }>(commentKey);
    if (cached) {
      applyComments(cached);
    }

    // 항상 서버에서 최신 user_liked 상태 백그라운드 갱신
    fetch(`/api/gallery/${category}/${index}/comments`)
      .then((r) => r.json())
      .then((data) => {
        setCached(commentKey, data);
        // 캐시 유무와 관계없이 최신 댓글 목록/좋아요 상태 동기화
        const list: (GalleryComment & { user_liked?: boolean })[] = data.comments ?? [];
        setComments(list);
        const likes: Record<string, { liked: boolean; count: number }> = {};
        list.forEach((c) => {
          likes[c.id] = { liked: c.user_liked ?? false, count: c.like_count };
        });
        setCommentLikes(likes);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category, index]);

  // 하이라이트 댓글로 스크롤 + flash (시트 슬라이드 + 데이터 로드 완료 후)
  useEffect(() => {
    if (!highlightCommentId || loading) return;
    const scrollTimer = setTimeout(() => {
      const el = highlightRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        el.classList.remove("flash-highlight");
        void el.offsetWidth;
        el.classList.add("flash-highlight");
      }, 400);
    }, 100);
    return () => clearTimeout(scrollTimer);
  }, [highlightCommentId, loading]);

  // Supabase Realtime: 다른 사용자의 댓글 실시간 반영
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`gallery-comments-${category}-${index}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "gallery_comments",
          filter: `item_category=eq.${category}&item_index=eq.${index}`,
        },
        () => {
          // 삭제/답글까지 정확하게 맞추기 위해 전체 재조회
          fetch(`/api/gallery/${category}/${index}/comments`)
            .then((r) => r.json())
            .then((data) => {
              const list: (GalleryComment & { user_liked?: boolean })[] = data.comments ?? [];
              setComments(list);
              const likes: Record<string, { liked: boolean; count: number }> = {};
              list.forEach((c) => { likes[c.id] = { liked: c.user_liked ?? false, count: c.like_count }; });
              setCommentLikes(likes);
              setCached(`gallery_comments_${category}_${index}`, data);
            })
            .catch(() => {});
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [category, index]);

  // visibilitychange: 앱 복귀 시 백그라운드로 캐시 갱신
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      const commentKey = `gallery_comments_${category}_${index}`;
      fetch(`/api/gallery/${category}/${index}/comments`)
        .then((r) => r.json())
        .then((data) => {
          const list: (GalleryComment & { user_liked?: boolean })[] = data.comments ?? [];
          setComments(list);
          const likes: Record<string, { liked: boolean; count: number }> = {};
          list.forEach((c) => { likes[c.id] = { liked: c.user_liked ?? false, count: c.like_count }; });
          setCommentLikes(likes);
          setCached(commentKey, data);
        })
        .catch(() => {});
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => { document.removeEventListener("visibilitychange", handleVisibilityChange); };
  }, [category, index]);

  function dismiss() {
    if (closing) return;
    setDragY(0);
    setClosing(true);
    setTimeout(() => onClose(), 300);
  }

  const handleCommentLike = async (commentId: string) => {
    setAnimatingIds((s) => new Set(s).add(commentId));
    setTimeout(() => setAnimatingIds((s) => { const n = new Set(s); n.delete(commentId); return n; }), 450);
    const prev = commentLikes[commentId] ?? { liked: false, count: 0 };
    const nextLiked = !prev.liked;
    const nextCount = nextLiked ? prev.count + 1 : Math.max(prev.count - 1, 0);

    // 즉시 UI 반영
    setCommentLikes((s) => ({ ...s, [commentId]: { liked: nextLiked, count: nextCount } }));

    try {
      const res = await fetch(`/api/gallery/comments/${commentId}/likes`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setCommentLikes((s) => ({ ...s, [commentId]: { liked: data.liked, count: data.count } }));
        // 캐시에도 반영 → 댓글창 재오픈 시 정확한 liked 상태 유지
        const commentKey = `gallery_comments_${category}_${index}`;
        const cached = getCached<{ comments: (GalleryComment & { user_liked?: boolean })[] }>(commentKey);
        if (cached?.comments) {
          const updatedComments = cached.comments.map((c) =>
            c.id === commentId ? { ...c, user_liked: data.liked, like_count: data.count } : c
          );
          setCached(commentKey, { ...cached, comments: updatedComments });
        }
      } else {
        // 실패 시 롤백
        setCommentLikes((s) => ({ ...s, [commentId]: prev }));
      }
    } catch {
      setCommentLikes((s) => ({ ...s, [commentId]: prev }));
    }
  };

  const handleSubmit = async () => {
    if (!input.trim() || submitting) return;
    setSubmitting(true);

    const tempId = "temp-" + Date.now();
    const knownUsernameFromComments =
      myEmail
        ? commentsRef.current.find((c) => c.author_email?.toLowerCase() === myEmail && c.author_username)?.author_username ?? null
        : null;
    const optimisticUsername = user?.username ?? knownUsernameFromComments ?? null;
    const parentId = replyTo?.parentId ?? null;
    const targetEmail = replyTo?.target.author_email?.toLowerCase() ?? null;
    const targetUsername = replyTo?.target.author_username ?? null;
    const isReplyToSelfByEmail = !!(replyTo && myEmail && targetEmail && myEmail === targetEmail);
    const isReplyToSelfByUsername = !!(replyTo && user?.username && targetUsername && user.username === targetUsername);
    const shouldShowReplyTarget = !!replyTo && !isReplyToSelfByEmail && !isReplyToSelfByUsername;
    const replyTargetLabel = shouldShowReplyTarget
      ? (replyTo.target.author_username
        ? replyTo.target.author_username
        : replyTo.target.author_email
          ? maskEmail(replyTo.target.author_email)
          : "익명")
      : null;
    const baseContent = input.trim();
    const contentWithReplyTarget = replyTargetLabel ? `${replyTargetLabel} 👈 ${baseContent}` : baseContent;
    const tempComment: GalleryComment = {
      id: tempId,
      profile_id: "",
      parent_id: parentId,
      item_category: category,
      item_index: index,
      content: contentWithReplyTarget,
      like_count: 0,
      created_at: new Date().toISOString(),
      author_username: optimisticUsername,
      author_fullname: (user?.fullName ?? null),
      author_icon_image: null,
      // 임시 댓글에서는 이메일 fallback을 숨겨 아이디로만 표시되게 유지
      author_email: null,
    };

    // 즉시 UI 반영
    setComments((prev) => [...prev, tempComment]);
    setCommentLikes((prev) => ({ ...prev, [tempId]: { liked: false, count: 0 } }));
    setInput("");
    setReplyTo(null);
    onCommentAdded();

    try {
      const res = await fetch(`/api/gallery/${category}/${index}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: contentWithReplyTarget, parentId }),
      });
      if (res.ok) {
        const comment: GalleryComment = await res.json();
        setComments((prev) => prev.map((c) => (c.id === tempId ? comment : c)));
        setCommentLikes((prev) => {
          const next = { ...prev };
          delete next[tempId];
          next[comment.id] = { liked: false, count: 0 };
          return next;
        });
        // 캐시 업데이트 → 댓글창 재오픈 시 새 댓글 유지
        const commentKey = `gallery_comments_${category}_${index}`;
        const cached = getCached<{ comments: GalleryComment[] }>(commentKey);
        if (cached?.comments) {
          const withoutTemp = cached.comments.filter((c) => c.id !== tempId);
          setCached(commentKey, { ...cached, comments: [...withoutTemp, comment] });
        }
      } else {
        // 실패 시 롤백
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        setCommentLikes((prev) => { const next = { ...prev }; delete next[tempId]; return next; });
      }
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setCommentLikes((prev) => { const next = { ...prev }; delete next[tempId]; return next; });
    } finally {
      setSubmitting(false);
    }
  };

  const canDeleteComment = (comment: GalleryComment) => {
    const byEmail = !!(myEmail && comment.author_email?.toLowerCase() === myEmail);
    const byUsername = !!(user?.username && comment.author_username === user.username);
    return byEmail || byUsername;
  };

  const isDeletedComment = (comment: GalleryComment) =>
    comment.content === ROOT_SOFT_DELETE_BLIND_TEXT || !!comment.is_deleted;

  const requestDelete = (comment: GalleryComment) => {
    if (!canDeleteComment(comment) || isDeletedComment(comment)) return;
    setDeleteConfirmId(comment.id);
  };

  const handleDelete = async (comment: GalleryComment) => {
    if (!canDeleteComment(comment) || isDeletedComment(comment)) return;
    setDeleteConfirmId(null);
    setDeletingIds((prev) => new Set(prev).add(comment.id));

    try {
      const res = await fetch(`/api/gallery/comments/${comment.id}`, { method: "DELETE" });
      if (!res.ok) {
        return;
      }
      const data = await res.json() as { deletedCount?: number; softDeleted?: boolean };
      const commentKey = `gallery_comments_${category}_${index}`;
      if (data.softDeleted) {
        setComments((prev) =>
          prev.map((c) => (c.id === comment.id ? { ...c, content: ROOT_SOFT_DELETE_BLIND_TEXT } : c))
        );
        const cached = getCached<{ comments: (GalleryComment & { user_liked?: boolean })[] }>(commentKey);
        if (cached?.comments) {
          setCached(commentKey, {
            ...cached,
            comments: cached.comments.map((c) =>
              c.id === comment.id ? { ...c, content: ROOT_SOFT_DELETE_BLIND_TEXT } : c
            ),
          });
        }
        return;
      }

      const deletedCount = typeof data.deletedCount === "number" ? data.deletedCount : 1;
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
      setCommentLikes((prev) => {
        const next = { ...prev };
        delete next[comment.id];
        return next;
      });
      if (replyTo?.target.id === comment.id) {
        setReplyTo(null);
      }
      onCommentDeleted?.(deletedCount);
      const cached = getCached<{ comments: (GalleryComment & { user_liked?: boolean })[] }>(commentKey);
      if (cached?.comments) {
        setCached(commentKey, {
          ...cached,
          comments: cached.comments.filter((c) => c.id !== comment.id),
        });
      }
    } catch {
      // no-op
    } finally {
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(comment.id); return next; });
    }
  };

  const rootComments = comments.filter((c) => !c.parent_id);
  const getReplies = (parentId: string) => comments.filter((c) => c.parent_id === parentId);

  const renderCommentItem = (c: GalleryComment, isReply = false, replyRoot?: GalleryComment) => {
    const likeState = commentLikes[c.id] ?? { liked: false, count: c.like_count };
    const isHighlight = c.id === highlightCommentId;
    const isDeleted = isDeletedComment(c);
    const isDeleteConfirmOpen = deleteConfirmId === c.id && !isDeleted;
    const relativeTime = formatCommentRelativeTime(c.created_at, nowTick);
    return (
      <div
        key={c.id}
        ref={isHighlight ? highlightRef : undefined}
        className={`gallery-comment-item${isReply ? " is-reply" : ""}${isDeleted ? " is-deleted" : ""}`}
      >
        {c.author_icon_image ? (
          <img src={c.author_icon_image} className="gallery-comment-avatar gallery-comment-avatar-img" alt="" />
        ) : (
          <div className="gallery-comment-avatar gallery-comment-avatar-default">
            <span className="gallery-comment-avatar-head" />
            <span className="gallery-comment-avatar-body" />
          </div>
        )}
        <div className="gallery-comment-body">
          <span className="gallery-comment-author-row">
            <span className="gallery-comment-author">
              {c.author_username
                ? c.author_username
                : c.author_email
                  ? maskEmail(c.author_email)
                  : "익명"}
            </span>
            {relativeTime && <span className="gallery-comment-time">{relativeTime}</span>}
          </span>
          <span className={`gallery-comment-content${isDeleted ? " is-deleted" : ""}`}>
            {isDeleted ? ROOT_SOFT_DELETE_BLIND_TEXT : c.content}
          </span>
          {!isDeleted && (
            <div className="gallery-comment-actions">
              {isDeleteConfirmOpen ? (
                <>
                  <button
                    type="button"
                    className="gallery-comment-inline-confirm-btn cancel"
                    onClick={() => setDeleteConfirmId(null)}
                    disabled={deletingIds.has(c.id)}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="gallery-comment-inline-confirm-btn confirm"
                    onClick={() => void handleDelete(c)}
                    disabled={deletingIds.has(c.id)}
                  >
                    {deletingIds.has(c.id) ? "삭제중..." : "삭제"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="gallery-comment-action-btn"
                    onClick={() => {
                      const parentId = replyRoot ? replyRoot.id : (c.parent_id ?? c.id);
                      setReplyTo({ target: c, parentId });
                      setDeleteConfirmId(null);
                    }}
                  >
                    답글 달기
                  </button>
                  {canDeleteComment(c) && (
                    <button
                      type="button"
                      className="gallery-comment-action-btn delete"
                      onClick={() => requestDelete(c)}
                      disabled={deletingIds.has(c.id)}
                    >
                      {deletingIds.has(c.id) ? "삭제중..." : "삭제"}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        <button
          className={`gallery-comment-like-btn${likeState.liked ? " liked" : ""}${animatingIds.has(c.id) ? " heart-animate" : ""}`}
          onClick={() => handleCommentLike(c.id)}
          disabled={isDeleted}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill={likeState.liked ? "#ef4444" : "none"}
            stroke={likeState.liked ? "#ef4444" : "currentColor"}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {likeState.count > 0 && <span>{likeState.count}</span>}
        </button>
      </div>
    );
  };

  // 드래그 핸들러
  function onDragStart(e: TouchEvent) {
    isDragging.current = true;
    dragStartY.current = e.touches[0].clientY;
  }

  function onDragMove(e: TouchEvent) {
    if (!isDragging.current) return;
    const diff = e.touches[0].clientY - dragStartY.current;
    if (expanded) {
      // 확장 상태: 아래로만
      if (diff > 0) setDragY(diff);
    } else {
      // 기본 상태: 위아래 모두
      setDragY(diff);
    }
  }

  function onDragEnd() {
    isDragging.current = false;
    if (expanded) {
      if (dragY > 100) setExpanded(false); // 70vh로 복귀
      setDragY(0);
    } else {
      if (dragY < -60) {
        setExpanded(true); // 전체화면 확장
        setDragY(0);
      } else if (dragY > 80) {
        dismiss(); // 닫기
      } else {
        setDragY(0);
      }
    }
  }

  const panelStyle: CSSProperties = {
    height: expanded ? "100dvh" : "70vh",
    borderRadius: expanded ? "0" : "20px 20px 0 0",
    transform: closing
      ? "translateY(100%)"
      : dragY > 0
        ? `translateY(${dragY}px)`
        : undefined,
    transition: isDragging.current
      ? "none"
      : closing
        ? "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)"
        : "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), height 0.3s cubic-bezier(0.32, 0.72, 0, 1), border-radius 0.3s",
  };

  return (
    <div
      className={`gallery-sheet-overlay${closing ? " is-closing" : ""}`}
      onClick={dismiss}
    >
      <div
        className="gallery-sheet-panel"
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 드래그 핸들 + 타이틀 — 드래그 영역 */}
        <div
          className="gallery-sheet-drag-area"
          onTouchStart={onDragStart}
          onTouchMove={onDragMove}
          onTouchEnd={onDragEnd}
        >
          <div className="gallery-sheet-handle" />
          <p className="gallery-sheet-title">댓글</p>
        </div>

        <div className="gallery-sheet-comments">
          {loading && <p className="gallery-sheet-empty">불러오는 중...</p>}
          {!loading && comments.length === 0 && (
            <p className="gallery-sheet-empty">첫 번째 댓글을 남겨보세요</p>
          )}
          {rootComments.map((comment) => (
            <div key={comment.id} className="gallery-comment-thread">
              {renderCommentItem(comment)}
              <div className="gallery-comment-replies">
                {getReplies(comment.id).map((reply) => renderCommentItem(reply, true, comment))}
              </div>
            </div>
          ))}
        </div>

        <div className="gallery-sheet-emoji-row">
          {["❤️","😍","🥰","😊","😂","🔥","✨","👍","🎉","💯"].map((emoji) => (
            <button
              key={emoji}
              className="gallery-sheet-emoji-btn"
              onClick={() => setInput((prev) => prev + emoji)}
              type="button"
            >
              {emoji}
            </button>
          ))}
        </div>

        {replyTo && (
          <div className="gallery-replying-banner">
            <span>
              {(replyTo.target.author_username ?? (replyTo.target.author_email ? maskEmail(replyTo.target.author_email) : "익명"))}에게 답글 남기는 중...
            </span>
            <button type="button" onClick={() => setReplyTo(null)}>취소</button>
          </div>
        )}

        <div className="gallery-sheet-input-row">
          <textarea
            className="gallery-sheet-input"
            placeholder={replyTo ? "답글을 남겨보세요" : "댓글을 남겨보세요"}
            value={input}
            rows={1}
            maxLength={300}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onFocus={(e) => {
              if (!isSignedIn) {
                e.target.blur();
                router.push(buildSignInHrefFromCurrentLocation());
              }
            }}
          />
          <button
            className="gallery-sheet-submit"
            onClick={handleSubmit}
            disabled={!input.trim() || submitting}
          >
            등록
          </button>
        </div>
      </div>
    </div>
  );
}
