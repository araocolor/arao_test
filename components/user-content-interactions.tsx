"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

type Comment = {
  id: string;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  authorId: string;
  iconImage: string | null;
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

function getCommentsCache(reviewId: string): Comment[] | null {
  try {
    const cached = sessionStorage.getItem(`user-review-comments-${reviewId}`);
    if (!cached) return null;
    const { data, ts } = JSON.parse(cached) as { data: { comments: Comment[] }; ts: number };
    if (Date.now() - ts < 60000) return data.comments ?? [];
  } catch {}
  return null;
}

export function UserContentInteractions({ reviewId }: { reviewId: string }) {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const cachedLikes = getLikesCache(reviewId);
  const cachedComments = getCommentsCache(reviewId);
  const [liked, setLiked] = useState(cachedLikes?.liked ?? false);
  const [likeCount, setLikeCount] = useState(cachedLikes?.likeCount ?? 0);
  const [likeLoading, setLikeLoading] = useState(false);
  const [comments, setComments] = useState<Comment[]>(cachedComments ?? []);
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const interactedRef = useRef(false);

  useEffect(() => {
    // 백그라운드 서버 동기화
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

    fetch(`/api/main/user-review/${reviewId}/comments`)
      .then((r) => r.json())
      .then((d) => {
        setComments(d.comments ?? []);
        try {
          sessionStorage.setItem(`user-review-comments-${reviewId}`, JSON.stringify({ data: d, ts: Date.now() }));
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
    } catch {
      setLiked(!nextLiked);
      setLikeCount((c) => c + (nextLiked ? -1 : 1));
    } finally {
      setLikeLoading(false);
      interactedRef.current = false;
    }
  }

  async function handleSubmitComment() {
    if (!isSignedIn) { router.push("/sign-in"); return; }
    if (!commentInput.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/main/user-review/${reviewId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentInput.trim() }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments((prev) => [...prev, newComment]);
        setCommentInput("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* 좋아요 섹션 */}
      <section className="user-content-like-section">
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

      {/* 댓글 섹션 */}
      <section className="user-content-comment-section">
        <p className="user-content-comment-label">댓글 {comments.length > 0 ? comments.length : ""}</p>

        {/* 댓글 목록 */}
        {comments.length > 0 && (
          <ul className="user-content-comment-list">
            {comments.map((c) => (
              <li key={c.id} className="user-content-comment-item">
                <span className="user-content-comment-avatar">
                  {c.iconImage
                    ? <img src={c.iconImage} alt="" className="user-content-comment-avatar-img" />
                    : <span className="user-content-comment-avatar-default">{c.authorId.slice(0, 1).toUpperCase()}</span>
                  }
                </span>
                <div className="user-content-comment-body">
                  <span className="user-content-comment-author">{c.authorId}</span>
                  <p className={`user-content-comment-text${c.isDeleted ? " deleted" : ""}`}>{c.content}</p>
                  <span className="user-content-comment-date">{formatDate(c.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* 댓글 입력폼 */}
        <div className="user-content-comment-form">
          <input
            type="text"
            className="user-content-comment-input"
            placeholder="댓글을 남겨보세요"
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
    </>
  );
}
