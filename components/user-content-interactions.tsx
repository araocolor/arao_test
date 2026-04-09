"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

type Comment = {
  id: string;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  parentId: string | null;
  authorId: string;
  iconImage: string | null;
  isMine?: boolean;
  likeCount: number;
  liked: boolean;
};

type ReplyContext = {
  target: Comment;
  parentId: string;
};

type SubmitButtonState = "idle" | "pending" | "error";

type ReviewCountPatch = {
  likeCount?: number;
  commentCount?: number;
};

const SOFT_DELETED_PARENT_TEXT = "댓글이 삭제되었습니다.";

function dispatchNotificationRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("notification-refresh"));
}

function sanitizeCount(value: number | undefined): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) return undefined;
  return Math.max(Math.trunc(value), 0);
}

function patchReviewCountCaches(reviewId: string, patch: ReviewCountPatch) {
  const nextLikeCount = sanitizeCount(patch.likeCount);
  const nextCommentCount = sanitizeCount(patch.commentCount);
  if (nextLikeCount === undefined && nextCommentCount === undefined) return;

  try {
    const PAGE_CACHE_PREFIX = "user-review-page-cache-v1:";
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      if (!key.startsWith("user-review-list-cache") && !key.startsWith(PAGE_CACHE_PREFIX)) continue;

      const raw = sessionStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as {
        data?: {
          items?: Array<{ id: string; likeCount?: number; commentCount?: number; [key: string]: unknown }>;
          [key: string]: unknown;
        };
        ts?: number;
      };

      if (!parsed.data || !Array.isArray(parsed.data.items)) continue;

      let changed = false;
      parsed.data.items = parsed.data.items.map((item) => {
        if (item.id !== reviewId) return item;
        const nextItem = { ...item };
        if (nextLikeCount !== undefined) nextItem.likeCount = nextLikeCount;
        if (nextCommentCount !== undefined) nextItem.commentCount = nextCommentCount;
        changed = true;
        return nextItem;
      });

      if (!changed) continue;
      parsed.ts = Date.now();
      sessionStorage.setItem(key, JSON.stringify(parsed));
    }
  } catch {}
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${m}.${day} ${h}:${min}`;
}

function getLikesCache(reviewId: string): { liked: boolean; likeCount: number } | null {
  try {
    const cached = sessionStorage.getItem(`user-review-likes-${reviewId}`);
    if (!cached) return null;
    const { data, ts } = JSON.parse(cached) as { data: { liked: boolean; likeCount: number }; ts: number };
    if (Date.now() - ts < 60000) return data;
  } catch {}
  return null;
}

function setLikesCache(reviewId: string, next: { liked: boolean; likeCount: number }) {
  try {
    sessionStorage.setItem(`user-review-likes-${reviewId}`, JSON.stringify({ data: next, ts: Date.now() }));
  } catch {}
  patchReviewCountCaches(reviewId, { likeCount: next.likeCount });
}

function setCommentCountCache(reviewId: string, nextCommentCount: number) {
  patchReviewCountCaches(reviewId, { commentCount: nextCommentCount });
}

function getCommentsCache(reviewId: string): Comment[] | null {
  try {
    const cached = sessionStorage.getItem(`user-review-comments-${reviewId}`);
    if (!cached) return null;
    const { data, ts } = JSON.parse(cached) as { data: { comments: Comment[] }; ts: number };
    if (Date.now() - ts < 60000) {
      return (data.comments ?? []).map((comment) => ({ ...comment, parentId: comment.parentId ?? null, likeCount: comment.likeCount ?? 0, liked: comment.liked ?? false }));
    }
  } catch {}
  return null;
}

function getVisibleCommentCount(comments: Comment[]): number {
  return comments.reduce((count, comment) => count + (comment.isDeleted ? 0 : 1), 0);
}

export function UserContentLikeSection({
  reviewId,
  onLikeCountChange,
}: {
  reviewId: string;
  onLikeCountChange?: (nextLikeCount: number) => void;
}) {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const cachedLikes = getLikesCache(reviewId);
  const [liked, setLiked] = useState(cachedLikes?.liked ?? false);
  const [likeCount, setLikeCount] = useState(cachedLikes?.likeCount ?? 0);
  const [likeLoading, setLikeLoading] = useState(false);
  const interactedRef = useRef(false);

  useEffect(() => {
    fetch(`/api/main/user-review/${reviewId}/likes`)
      .then((r) => r.json())
      .then((d) => {
        if (interactedRef.current) return;
        const nextLiked = d.liked ?? false;
        const nextLikeCount = sanitizeCount(d.likeCount) ?? 0;
        setLiked(nextLiked);
        setLikeCount(nextLikeCount);
        onLikeCountChange?.(nextLikeCount);
        setLikesCache(reviewId, { liked: nextLiked, likeCount: nextLikeCount });
      })
      .catch(() => {});
  }, [reviewId, onLikeCountChange]);

  async function handleLike() {
    if (!isSignedIn) { router.push("/sign-in"); return; }
    if (likeLoading) return;
    const prevLiked = liked;
    const prevLikeCount = likeCount;
    interactedRef.current = true;
    setLikeLoading(true);
    const nextLiked = !prevLiked;
    const optimisticLikeCount = Math.max(prevLikeCount + (nextLiked ? 1 : -1), 0);
    setLiked(nextLiked);
    setLikeCount(optimisticLikeCount);
    onLikeCountChange?.(optimisticLikeCount);
    try {
      const res = await fetch(`/api/main/user-review/${reviewId}/likes`, { method: "POST" });
      const d = await res.json();
      const nextLikeCount = sanitizeCount(d.likeCount) ?? 0;
      setLiked(d.liked);
      setLikeCount(nextLikeCount);
      setLikesCache(reviewId, { liked: d.liked, likeCount: nextLikeCount });
      onLikeCountChange?.(nextLikeCount);
      if (d.liked) dispatchNotificationRefresh();
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevLikeCount);
      onLikeCountChange?.(prevLikeCount);
    } finally {
      setLikeLoading(false);
      interactedRef.current = false;
    }
  }

  return (
    <section className="user-content-like-inline">
      <button
        type="button"
        className={`user-content-like-btn${liked ? " liked" : ""}`}
        onClick={handleLike}
        disabled={likeLoading}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill={liked ? "#FF2D2D" : "none"} stroke={liked ? "#FF2D2D" : "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {likeCount > 0 && <span className="user-content-like-count">{likeCount}</span>}
      </button>
    </section>
  );
}

export function UserContentInteractions({
  reviewId,
  reviewAuthorId,
  targetCommentId,
  onCommentCountChange,
}: {
  reviewId: string;
  reviewAuthorId?: string | null;
  targetCommentId?: string | null;
  onCommentCountChange?: (nextCommentCount: number) => void;
}) {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const cachedComments = getCommentsCache(reviewId);
  const [comments, setComments] = useState<Comment[]>(cachedComments ?? []);
  const commentsRef = useRef<Comment[]>(cachedComments ?? []);
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyContext | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");
  const commentTextareaElRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaElRef = useRef<HTMLTextAreaElement>(null);
  const [menuComment, setMenuComment] = useState<Comment | null>(null);
  const [pendingLikeCommentIds, setPendingLikeCommentIds] = useState<Set<string>>(new Set());
  const [submitButtonState, setSubmitButtonState] = useState<SubmitButtonState>("idle");
  const submitButtonStateTimerRef = useRef<number | null>(null);
  const lastCommentCountRef = useRef<number | null>(null);
  const highlightedCommentDoneRef = useRef<string | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const missingTargetNoticeTimerRef = useRef<number | null>(null);
  const commentSectionRef = useRef<HTMLElement | null>(null);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const [missingTargetNotice, setMissingTargetNotice] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(cachedComments !== null);
  const COMMENT_HIGHLIGHT_DURATION_MS = 1000;

  function setCommentsCache(nextComments: Comment[]) {
    try {
      sessionStorage.setItem(
        `user-review-comments-${reviewId}`,
        JSON.stringify({ data: { comments: nextComments }, ts: Date.now() })
      );
    } catch {}
  }

  const syncCommentCount = useCallback((nextComments: Comment[]) => {
    const nextCommentCount = getVisibleCommentCount(nextComments);
    if (lastCommentCountRef.current === nextCommentCount) return;
    lastCommentCountRef.current = nextCommentCount;
    setCommentCountCache(reviewId, nextCommentCount);
    onCommentCountChange?.(nextCommentCount);
  }, [reviewId, onCommentCountChange]);

  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
      }
      if (submitButtonStateTimerRef.current !== null) {
        window.clearTimeout(submitButtonStateTimerRef.current);
      }
      if (missingTargetNoticeTimerRef.current !== null) {
        window.clearTimeout(missingTargetNoticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    syncCommentCount(comments);
  }, [comments, syncCommentCount]);

  useEffect(() => {
    lastCommentCountRef.current = null;
    syncCommentCount(commentsRef.current);
  }, [reviewId, syncCommentCount]);

  useEffect(() => {
    const normalizedTargetId =
      typeof targetCommentId === "string" && targetCommentId.trim().length > 0
        ? targetCommentId.trim()
        : null;
    if (!normalizedTargetId) return;
    if (highlightedCommentDoneRef.current === normalizedTargetId) return;
    const targetEl = document.getElementById(`user-review-comment-${normalizedTargetId}`);
    if (!targetEl) {
      if (!commentsLoaded) return;
      highlightedCommentDoneRef.current = normalizedTargetId;
      window.requestAnimationFrame(() => {
        commentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      setMissingTargetNotice(true);
      if (missingTargetNoticeTimerRef.current !== null) {
        window.clearTimeout(missingTargetNoticeTimerRef.current);
      }
      missingTargetNoticeTimerRef.current = window.setTimeout(() => {
        setMissingTargetNotice(false);
        missingTargetNoticeTimerRef.current = null;
      }, 2400);
      return;
    }

    highlightedCommentDoneRef.current = normalizedTargetId;
    window.requestAnimationFrame(() => {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    setHighlightedCommentId(normalizedTargetId);
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightedCommentId((prev) => (prev === normalizedTargetId ? null : prev));
    }, COMMENT_HIGHLIGHT_DURATION_MS);
  }, [targetCommentId, comments, commentsLoaded, COMMENT_HIGHLIGHT_DURATION_MS]);

  function setCommentLikePending(commentId: string, pending: boolean) {
    setPendingLikeCommentIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(commentId);
      else next.delete(commentId);
      return next;
    });
  }

  const likeCommentMutation = useMutation<
    { liked: boolean; likeCount: number },
    Error,
    string,
    { previousComments: Comment[]; commentId: string }
  >({
    mutationFn: async (commentId: string) => {
      const res = await fetch(`/api/main/user-review/${reviewId}/comments/${commentId}/likes`, { method: "POST" });
      if (!res.ok) throw new Error("댓글 좋아요 반영 실패");
      return (await res.json()) as { liked: boolean; likeCount: number };
    },
    onMutate: async (commentId: string) => {
      const previousComments = commentsRef.current;
      setCommentLikePending(commentId, true);
      setComments((prev) => {
        const next = prev.map((comment) => {
          if (comment.id !== commentId) return comment;
          const nextLiked = !comment.liked;
          return {
            ...comment,
            liked: nextLiked,
            likeCount: Math.max(comment.likeCount + (nextLiked ? 1 : -1), 0),
          };
        });
        setCommentsCache(next);
        return next;
      });
      return { previousComments, commentId };
    },
    onSuccess: (data, commentId) => {
      setComments((prev) => {
        const next = prev.map((comment) =>
          comment.id === commentId
            ? { ...comment, liked: data.liked, likeCount: data.likeCount }
            : comment
        );
        setCommentsCache(next);
        return next;
      });
      if (data.liked) dispatchNotificationRefresh();
    },
    onError: (_error, _commentId, context) => {
      if (!context) return;
      setComments(context.previousComments);
      setCommentsCache(context.previousComments);
    },
    onSettled: (_data, _error, commentId, context) => {
      setCommentLikePending(context?.commentId ?? commentId, false);
    },
  });

  useEffect(() => {
    highlightedCommentDoneRef.current = null;
    setMissingTargetNotice(false);
    setCommentsLoaded(false);
    fetch(`/api/main/user-review/${reviewId}/comments`)
      .then((r) => r.json())
      .then((d) => {
        const nextComments: Comment[] = Array.isArray(d.comments)
          ? d.comments.map((comment: Comment) => ({ ...comment, parentId: comment.parentId ?? null, likeCount: comment.likeCount ?? 0, liked: comment.liked ?? false }))
          : [];
        setComments(nextComments);
        try {
          sessionStorage.setItem(
            `user-review-comments-${reviewId}`,
            JSON.stringify({ data: { comments: nextComments }, ts: Date.now() })
          );
        } catch {}
      })
      .catch(() => {})
      .finally(() => {
        setCommentsLoaded(true);
      });
  }, [reviewId, syncCommentCount]);

  function editRows(text: string) {
    return Math.max(text.split("\n").length, 1);
  }

  function focusCommentTextarea() {
    const textarea = commentTextareaElRef.current;
    if (!textarea) return;
    textarea.focus();
    const cursor = textarea.value.length;
    try {
      textarea.setSelectionRange(cursor, cursor);
    } catch {}
  }

  function startReply(target: Comment, parentId: string) {
    setReplyTo({ target, parentId });
    setSubmitButtonState("idle");
    focusCommentTextarea();
  }

  function updateSubmitButtonState(next: SubmitButtonState, autoResetMs?: number) {
    if (submitButtonStateTimerRef.current !== null) {
      window.clearTimeout(submitButtonStateTimerRef.current);
      submitButtonStateTimerRef.current = null;
    }

    setSubmitButtonState(next);
    if (!autoResetMs) return;

    submitButtonStateTimerRef.current = window.setTimeout(() => {
      setSubmitButtonState("idle");
      submitButtonStateTimerRef.current = null;
    }, autoResetMs);
  }

  async function handleSubmitComment() {
    if (!isSignedIn) { router.push("/sign-in"); return; }
    if (!commentInput.trim() || submitting) return;
    const submittingReply = replyTo !== null;
    if (submittingReply) {
      updateSubmitButtonState("pending");
    } else {
      updateSubmitButtonState("idle");
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/main/user-review/${reviewId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentInput.trim(), parentId: replyTo?.parentId ?? null }),
      });
      if (res.ok) {
        const rawComment = (await res.json()) as Partial<Comment>;
        const newComment: Comment = {
          id: rawComment.id ?? crypto.randomUUID(),
          content: rawComment.content ?? "",
          isDeleted: rawComment.isDeleted ?? false,
          createdAt: rawComment.createdAt ?? new Date().toISOString(),
          parentId: rawComment.parentId ?? null,
          authorId: rawComment.authorId ?? "익명",
          iconImage: rawComment.iconImage ?? null,
          isMine: rawComment.isMine ?? true,
          likeCount: sanitizeCount(rawComment.likeCount) ?? 0,
          liked: rawComment.liked ?? false,
        };
        setComments((prev) => {
          const next = [...prev, newComment];
          setCommentsCache(next);
          return next;
        });
        setCommentInput("");
        setReplyTo(null);
        if (submittingReply) {
          updateSubmitButtonState("idle");
        }
        dispatchNotificationRefresh();
      } else if (submittingReply) {
        updateSubmitButtonState("error", 2200);
      }
    } catch {
      if (submittingReply) {
        updateSubmitButtonState("error", 2200);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditComment(commentId: string) {
    if (!editInput.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/main/user-review/${reviewId}/comments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, content: editInput.trim() }),
      });
      if (res.ok) {
        setComments((prev) => {
          const next = prev.map((c) => c.id === commentId ? { ...c, content: editInput.trim() } : c);
          setCommentsCache(next);
          return next;
        });
        setEditingId(null);
        setEditInput("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLikeComment(commentId: string) {
    if (!isSignedIn) { router.push("/sign-in"); return; }
    if (pendingLikeCommentIds.has(commentId)) return;
    likeCommentMutation.mutate(commentId);
  }

  async function handleDeleteComment(commentId: string) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/main/user-review/${reviewId}/comments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      if (res.ok) {
        const payload = (await res.json()) as {
          ok?: boolean;
          mode?: "hard" | "soft";
          commentId?: string;
          content?: string;
        };
        const deletedCommentId = payload.commentId ?? commentId;
        const target = commentsRef.current.find((c) => c.id === deletedCommentId);
        const fallbackMode: "hard" | "soft" = target?.parentId ? "hard" : "soft";
        const deleteMode = payload.mode ?? fallbackMode;

        setComments((prev) => {
          const next = deleteMode === "hard"
            ? prev.filter((c) => c.id !== deletedCommentId)
            : prev.map((c) =>
              c.id === deletedCommentId
                ? { ...c, isDeleted: true, content: payload.content ?? SOFT_DELETED_PARENT_TEXT }
                : c
            );
          setCommentsCache(next);
          return next;
        });
        setReplyTo((prev) => (prev?.target.id === deletedCommentId ? null : prev));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const rootComments = comments.filter((comment) => !comment.parentId);
  const getReplies = (parentId: string) => comments.filter((comment) => comment.parentId === parentId);
  const isReviewAuthor = (authorId: string) => !!reviewAuthorId && authorId === reviewAuthorId;
  const visibleCommentCount = getVisibleCommentCount(comments);

  return (
    <section ref={commentSectionRef} className="user-content-comment-section">
      <p className="user-content-comment-label">댓글 {visibleCommentCount > 0 ? visibleCommentCount : ""}</p>
      {missingTargetNotice && (
        <p className="user-content-comment-missing-notice" role="status" aria-live="polite">
          삭제되었거나 찾을 수 없는 댓글임
        </p>
      )}

      {/* 댓글 목록 */}
      {comments.length > 0 && (
        <div className="user-content-comment-thread-list">
          {rootComments.map((comment) => (
            <div key={comment.id} className="user-content-comment-thread">
              <div
                id={`user-review-comment-${comment.id}`}
                className={`user-content-comment-item${comment.isMine ? " is-mine" : ""}${highlightedCommentId === comment.id ? " is-highlighted" : ""}`}
              >
                <span className="user-content-comment-avatar">
                  {comment.iconImage
                    ? <img src={comment.iconImage} alt="" className="user-content-comment-avatar-img" />
                    : <span className="user-content-comment-avatar-default">{comment.authorId.slice(0, 1).toUpperCase()}</span>
                  }
                </span>
                <div className="user-content-comment-body">
                  <div className="user-content-comment-author-row">
                    <span className="user-content-comment-author">
                      {comment.authorId}
                      {isReviewAuthor(comment.authorId) && (
                        <span className="user-content-comment-author-badge" aria-label="작성자">작성자</span>
                      )}
                    </span>
                    {comment.isMine && !comment.isDeleted && (
                      <button
                        type="button"
                        className="user-content-comment-more-btn"
                        onClick={() => { setMenuComment(comment); }}
                      >
                        ...
                      </button>
                    )}
                  </div>
                  {editingId === comment.id ? (
                    <div className="user-content-comment-edit-form">
                      <textarea
                        className="user-content-comment-input"
                        value={editInput}
                        onChange={(e) => setEditInput(e.target.value)}
                        rows={editRows(editInput)}
                        maxLength={300}
                        ref={(el) => { if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }}
                      />
                      <div className="user-content-comment-edit-actions">
                        <button type="button" className="user-content-comment-action-btn" onClick={() => { setEditingId(null); setEditInput(""); }}>취소</button>
                        <button type="button" className="user-content-comment-action-btn" onClick={() => handleEditComment(comment.id)} disabled={!editInput.trim() || submitting}>저장</button>
                      </div>
                    </div>
                  ) : (
                    <p className={`user-content-comment-text${comment.isDeleted ? " deleted" : ""}`}>{comment.content}</p>
                  )}
                  <span className="user-content-comment-date">{formatDate(comment.createdAt)}</span>
                  <div className="user-content-comment-actions">
                    {!comment.isDeleted && (
                      <button
                        type="button"
                        className="user-content-comment-action-btn"
                        onClick={() => startReply(comment, comment.id)}
                      >
                        댓글쓰기
                      </button>
                    )}
                    <button
                      type="button"
                      className="user-content-comment-like-btn"
                      onClick={() => handleLikeComment(comment.id)}
                      aria-label="좋아요"
                      disabled={pendingLikeCommentIds.has(comment.id)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill={comment.liked ? "#E02424" : "none"} stroke={comment.liked ? "#E02424" : "currentColor"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                      {comment.likeCount > 0 && <span>{comment.likeCount}</span>}
                    </button>
                  </div>
                </div>
              </div>

              <div className="user-content-comment-replies">
                {getReplies(comment.id).map((reply) => (
                  <div
                    key={reply.id}
                    id={`user-review-comment-${reply.id}`}
                    className={`user-content-comment-item is-reply${reply.isMine ? " is-mine" : ""}${highlightedCommentId === reply.id ? " is-highlighted" : ""}`}
                  >
                    <span className="user-content-comment-avatar">
                      {reply.iconImage
                        ? <img src={reply.iconImage} alt="" className="user-content-comment-avatar-img" />
                        : <span className="user-content-comment-avatar-default">{reply.authorId.slice(0, 1).toUpperCase()}</span>
                      }
                    </span>
                    <div className="user-content-comment-body">
                      <div className="user-content-comment-author-row">
                        <span className="user-content-comment-author">
                          {reply.authorId}
                          {isReviewAuthor(reply.authorId) && (
                            <span className="user-content-comment-author-badge" aria-label="작성자">작성자</span>
                          )}
                        </span>
                        <div className="user-content-comment-right">
                          {reply.isMine && !reply.isDeleted && (
                            <button
                              type="button"
                              className="user-content-comment-more-btn"
                              onClick={() => { setMenuComment(reply); }}
                            >
                              ...
                            </button>
                          )}
                        </div>
                      </div>
                      {editingId === reply.id ? (
                        <div className="user-content-comment-edit-form">
                          <textarea
                            className="user-content-comment-input"
                            value={editInput}
                            onChange={(e) => setEditInput(e.target.value)}
                            rows={editRows(editInput)}
                            maxLength={300}
                            ref={(el) => { if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }}
                          />
                          <div className="user-content-comment-edit-actions">
                            <button type="button" className="user-content-comment-action-btn" onClick={() => { setEditingId(null); setEditInput(""); }}>취소</button>
                            <button type="button" className="user-content-comment-action-btn" onClick={() => handleEditComment(reply.id)} disabled={!editInput.trim() || submitting}>저장</button>
                          </div>
                        </div>
                      ) : (
                        <p className={`user-content-comment-text${reply.isDeleted ? " deleted" : ""}`}>{reply.content}</p>
                      )}
                      <span className="user-content-comment-date">{formatDate(reply.createdAt)}</span>
                      <div className="user-content-comment-actions">
                        {!reply.isDeleted && (
                          <button
                            type="button"
                            className="user-content-comment-action-btn"
                            onClick={() => startReply(reply, comment.id)}
                          >
                            댓글쓰기
                          </button>
                        )}
                        <button
                          type="button"
                          className="user-content-comment-like-btn"
                          onClick={() => handleLikeComment(reply.id)}
                          aria-label="좋아요"
                          disabled={pendingLikeCommentIds.has(reply.id)}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill={reply.liked ? "#E02424" : "none"} stroke={reply.liked ? "#E02424" : "currentColor"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                          {reply.likeCount > 0 && <span>{reply.likeCount}</span>}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {replyTo && (
        <div className="user-content-replying-banner">
          <span>{replyTo.target.authorId}에게 답글 남기는 중...</span>
          <button type="button" onClick={() => { setReplyTo(null); updateSubmitButtonState("idle"); }}>
            취소
          </button>
        </div>
      )}

      {/* 댓글 입력폼 */}
      <div className="user-content-comment-form">
        <textarea
          ref={commentTextareaElRef}
          className="user-content-comment-input"
          placeholder={replyTo ? "답글을 남겨보세요" : "댓글을 남겨보세요"}
          value={commentInput}
          onChange={(e) => {
            setCommentInput(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          maxLength={300}
          rows={1}
        />
        <button
          type="button"
          className={`user-content-comment-submit${commentInput.trim() ? " active" : ""}`}
          onClick={handleSubmitComment}
          disabled={!commentInput.trim() || submitting}
        >
          {submitButtonState === "pending"
            ? "등록 중..."
            : submitButtonState === "error"
                ? "다시 시도"
                : "등록"}
        </button>
      </div>

      {/* 댓글 메뉴 바텀시트 */}
      {menuComment && (
        <>
          <div className="user-content-comment-sheet-backdrop" onClick={() => setMenuComment(null)} />
          <div className="user-content-comment-sheet">
            <button
              type="button"
              className="user-content-comment-sheet-item"
              onClick={() => {
                setEditingId(menuComment.id);
                setEditInput(menuComment.content);
                setMenuComment(null);
              }}
            >
              수정하기
            </button>
            <button
              type="button"
              className="user-content-comment-sheet-item danger"
              onClick={() => {
                handleDeleteComment(menuComment.id);
                setMenuComment(null);
              }}
            >
              삭제하기
            </button>
            <button
              type="button"
              className="user-content-comment-sheet-item cancel"
              onClick={() => setMenuComment(null)}
            >
              창닫기
            </button>
          </div>
        </>
      )}
    </section>
  );
}
