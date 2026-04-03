"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

type Comment = {
  id: string;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  parentId: string | null;
  authorId: string;
  iconImage: string | null;
};

type ReplyContext = {
  target: Comment;
  parentId: string;
};

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
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i);
      if (!key || !key.startsWith("user-review-list-cache")) continue;
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        data?: { items?: Array<{ id: string; likeCount?: number }>; [key: string]: unknown };
        ts?: number;
      };
      if (!parsed.data || !Array.isArray(parsed.data.items)) continue;
      parsed.data.items = parsed.data.items.map((item) =>
        item.id === reviewId ? { ...item, likeCount: next.likeCount } : item
      );
      parsed.ts = Date.now();
      sessionStorage.setItem(key, JSON.stringify(parsed));
    }
  } catch {}
}

function getCommentsCache(reviewId: string): Comment[] | null {
  try {
    const cached = sessionStorage.getItem(`user-review-comments-${reviewId}`);
    if (!cached) return null;
    const { data, ts } = JSON.parse(cached) as { data: { comments: Comment[] }; ts: number };
    if (Date.now() - ts < 60000) {
      return (data.comments ?? []).map((comment) => ({ ...comment, parentId: comment.parentId ?? null }));
    }
  } catch {}
  return null;
}

export function UserContentLikeSection({ reviewId }: { reviewId: string }) {
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
        setLiked(d.liked ?? false);
        setLikeCount(d.likeCount ?? 0);
        try {
          sessionStorage.setItem(`user-review-likes-${reviewId}`, JSON.stringify({ data: d, ts: Date.now() }));
        } catch {}
      })
      .catch(() => {});
  }, [reviewId]);

  async function handleLike() {
    if (!isSignedIn) { router.push("/sign-in"); return; }
    if (likeLoading) return;
    interactedRef.current = true;
    setLikeLoading(true);
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((c) => c + (nextLiked ? 1 : -1));
    try {
      const res = await fetch(`/api/main/user-review/${reviewId}/likes`, { method: "POST" });
      const d = await res.json();
      setLiked(d.liked);
      setLikeCount(d.likeCount);
      setLikesCache(reviewId, { liked: d.liked, likeCount: d.likeCount });
    } catch {
      setLiked(!nextLiked);
      setLikeCount((c) => c + (nextLiked ? -1 : 1));
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

export function UserContentInteractions({ reviewId }: { reviewId: string }) {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const cachedComments = getCommentsCache(reviewId);
  const [comments, setComments] = useState<Comment[]>(cachedComments ?? []);
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyContext | null>(null);

  function setCommentsCache(nextComments: Comment[]) {
    try {
      sessionStorage.setItem(
        `user-review-comments-${reviewId}`,
        JSON.stringify({ data: { comments: nextComments }, ts: Date.now() })
      );
    } catch {}
  }

  useEffect(() => {
    fetch(`/api/main/user-review/${reviewId}/comments`)
      .then((r) => r.json())
      .then((d) => {
        const nextComments: Comment[] = Array.isArray(d.comments)
          ? d.comments.map((comment: Comment) => ({ ...comment, parentId: comment.parentId ?? null }))
          : [];
        setComments(nextComments);
        try {
          sessionStorage.setItem(
            `user-review-comments-${reviewId}`,
            JSON.stringify({ data: { comments: nextComments }, ts: Date.now() })
          );
        } catch {}
      })
      .catch(() => {});
  }, [reviewId]);

  async function handleSubmitComment() {
    if (!isSignedIn) { router.push("/sign-in"); return; }
    if (!commentInput.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/main/user-review/${reviewId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentInput.trim(), parentId: replyTo?.parentId ?? null }),
      });
      if (res.ok) {
        const rawComment = (await res.json()) as Comment;
        const newComment: Comment = { ...rawComment, parentId: rawComment.parentId ?? null };
        setComments((prev) => {
          const next = [...prev, newComment];
          setCommentsCache(next);
          return next;
        });
        setCommentInput("");
        setReplyTo(null);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const rootComments = comments.filter((comment) => !comment.parentId);
  const getReplies = (parentId: string) => comments.filter((comment) => comment.parentId === parentId);

  return (
    <section className="user-content-comment-section">
      <p className="user-content-comment-label">댓글 {comments.length > 0 ? comments.length : ""}</p>

      {/* 댓글 목록 */}
      {comments.length > 0 && (
        <div className="user-content-comment-thread-list">
          {rootComments.map((comment) => (
            <div key={comment.id} className="user-content-comment-thread">
              <div className="user-content-comment-item">
                <span className="user-content-comment-avatar">
                  {comment.iconImage
                    ? <img src={comment.iconImage} alt="" className="user-content-comment-avatar-img" />
                    : <span className="user-content-comment-avatar-default">{comment.authorId.slice(0, 1).toUpperCase()}</span>
                  }
                </span>
                <div className="user-content-comment-body">
                  <span className="user-content-comment-author">{comment.authorId}</span>
                  <p className={`user-content-comment-text${comment.isDeleted ? " deleted" : ""}`}>{comment.content}</p>
                  <span className="user-content-comment-date">{formatDate(comment.createdAt)}</span>
                  {!comment.isDeleted && (
                    <div className="user-content-comment-actions">
                      <button
                        type="button"
                        className="user-content-comment-action-btn"
                        onClick={() => setReplyTo({ target: comment, parentId: comment.id })}
                      >
                        답글 달기
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="user-content-comment-replies">
                {getReplies(comment.id).map((reply) => (
                  <div key={reply.id} className="user-content-comment-item is-reply">
                    <span className="user-content-comment-avatar">
                      {reply.iconImage
                        ? <img src={reply.iconImage} alt="" className="user-content-comment-avatar-img" />
                        : <span className="user-content-comment-avatar-default">{reply.authorId.slice(0, 1).toUpperCase()}</span>
                      }
                    </span>
                    <div className="user-content-comment-body">
                      <span className="user-content-comment-author">{reply.authorId}</span>
                      <p className={`user-content-comment-text${reply.isDeleted ? " deleted" : ""}`}>{reply.content}</p>
                      <span className="user-content-comment-date">{formatDate(reply.createdAt)}</span>
                      {!reply.isDeleted && (
                        <div className="user-content-comment-actions">
                          <button
                            type="button"
                            className="user-content-comment-action-btn"
                            onClick={() => setReplyTo({ target: reply, parentId: comment.id })}
                          >
                            답글 달기
                          </button>
                        </div>
                      )}
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
          <button type="button" onClick={() => setReplyTo(null)}>
            취소
          </button>
        </div>
      )}

      {/* 댓글 입력폼 */}
      <div className="user-content-comment-form">
        <input
          type="text"
          className="user-content-comment-input"
          placeholder={replyTo ? "답글을 남겨보세요" : "댓글을 남겨보세요"}
          value={commentInput}
          onChange={(e) => setCommentInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSubmitComment(); }}
          maxLength={300}
        />
        <button
          type="button"
          className={`user-content-comment-submit${commentInput.trim() ? " active" : ""}`}
          onClick={handleSubmitComment}
          disabled={!commentInput.trim() || submitting}
        >
          등록
        </button>
      </div>
    </section>
  );
}
