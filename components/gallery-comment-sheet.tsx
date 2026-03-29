"use client";

import { useState, useEffect } from "react";
import type { GalleryComment } from "@/lib/gallery-interactions";

type Props = {
  category: string;
  index: number;
  onClose: () => void;
  onCommentAdded: () => void;
};

export function GalleryCommentSheet({ category, index, onClose, onCommentAdded }: Props) {
  const [comments, setComments] = useState<GalleryComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [commentLikes, setCommentLikes] = useState<Record<string, { liked: boolean; count: number }>>({});

  useEffect(() => {
    fetch(`/api/gallery/${category}/${index}/comments`)
      .then((r) => r.json())
      .then((data) => {
        const list: GalleryComment[] = data.comments ?? [];
        setComments(list);
        const likes: Record<string, { liked: boolean; count: number }> = {};
        list.forEach((c) => {
          likes[c.id] = { liked: false, count: c.like_count };
        });
        setCommentLikes(likes);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category, index]);

  const handleCommentLike = async (commentId: string) => {
    const res = await fetch(`/api/gallery/comments/${commentId}/likes`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setCommentLikes((prev) => ({ ...prev, [commentId]: { liked: data.liked, count: data.count } }));
    }
  };

  const handleSubmit = async () => {
    if (!input.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/gallery/${category}/${index}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input.trim() }),
      });
      if (res.ok) {
        const comment: GalleryComment = await res.json();
        setComments((prev) => [...prev, comment]);
        setCommentLikes((prev) => ({ ...prev, [comment.id]: { liked: false, count: 0 } }));
        setInput("");
        onCommentAdded();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="gallery-sheet-overlay" onClick={onClose}>
      <div className="gallery-sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="gallery-sheet-handle" />
        <div className="gallery-sheet-header">
          <span>댓글</span>
          <button className="gallery-sheet-close" onClick={onClose}>✕</button>
        </div>
        <div className="gallery-sheet-comments">
          {loading && <p className="gallery-sheet-empty">불러오는 중...</p>}
          {!loading && comments.length === 0 && (
            <p className="gallery-sheet-empty">첫 번째 댓글을 남겨보세요</p>
          )}
          {comments.map((c) => {
            const likeState = commentLikes[c.id] ?? { liked: false, count: c.like_count };
            return (
              <div key={c.id} className="gallery-comment-item">
                <div className="gallery-comment-avatar" />
                <div className="gallery-comment-body">
                  <span className="gallery-comment-author">{c.author_username ?? "익명"}</span>
                  <span className="gallery-comment-content">{c.content}</span>
                </div>
                <button
                  className={`gallery-comment-like-btn${likeState.liked ? " liked" : ""}`}
                  onClick={() => handleCommentLike(c.id)}
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
          })}
        </div>
        <div className="gallery-sheet-input-row">
          <div className="gallery-comment-avatar gallery-comment-avatar-sm" />
          <input
            className="gallery-sheet-input"
            placeholder="댓글 달기..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <button
            className="gallery-sheet-submit"
            onClick={handleSubmit}
            disabled={!input.trim() || submitting}
          >
            게시
          </button>
        </div>
      </div>
    </div>
  );
}
