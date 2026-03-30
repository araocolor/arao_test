"use client";

import { useState, useEffect, useRef } from "react";
import type { GalleryComment } from "@/lib/gallery-interactions";
import { getCached, setCached } from "@/hooks/use-prefetch-cache";

function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex < 0) return email;
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  return local.slice(0, 2) + "***" + domain;
}

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
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const isDragging = useRef(false);
  const dragStartY = useRef(0);

  useEffect(() => {
    const commentKey = `gallery_comments_${category}_${index}`;

    function applyComments(data: { comments?: GalleryComment[] }) {
      const list: GalleryComment[] = data.comments ?? [];
      setComments(list);
      const likes: Record<string, { liked: boolean; count: number }> = {};
      list.forEach((c) => { likes[c.id] = { liked: false, count: c.like_count }; });
      setCommentLikes(likes);
      setLoading(false);
    }

    // 캐시 히트 시 즉시 표시
    const cached = getCached<{ comments: GalleryComment[] }>(commentKey);
    if (cached) {
      applyComments(cached);
      return;
    }

    fetch(`/api/gallery/${category}/${index}/comments`)
      .then((r) => r.json())
      .then((data) => {
        setCached(commentKey, data);
        applyComments(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category, index]);

  function dismiss() {
    if (closing) return;
    setDragY(0);
    setClosing(true);
    setTimeout(() => onClose(), 300);
  }

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

    const tempId = "temp-" + Date.now();
    const tempComment: GalleryComment = {
      id: tempId,
      profile_id: "",
      item_category: category,
      item_index: index,
      content: input.trim(),
      like_count: 0,
      created_at: new Date().toISOString(),
      author_username: null,
      author_fullname: null,
      author_icon_image: null,
      author_email: null,
    };

    // 즉시 UI 반영
    setComments((prev) => [...prev, tempComment]);
    setCommentLikes((prev) => ({ ...prev, [tempId]: { liked: false, count: 0 } }));
    setInput("");
    onCommentAdded();

    try {
      const res = await fetch(`/api/gallery/${category}/${index}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: tempComment.content }),
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

  // 드래그 핸들러 (handle + header 영역)
  function onDragStart(e: React.TouchEvent) {
    isDragging.current = true;
    dragStartY.current = e.touches[0].clientY;
  }

  function onDragMove(e: React.TouchEvent) {
    if (!isDragging.current) return;
    const diff = e.touches[0].clientY - dragStartY.current;
    if (diff > 0) setDragY(diff);
  }

  function onDragEnd() {
    isDragging.current = false;
    if (dragY > 80) {
      dismiss();
    } else {
      setDragY(0);
    }
  }

  const panelStyle: React.CSSProperties = {
    transform: closing
      ? "translateY(100%)"
      : dragY > 0
        ? `translateY(${dragY}px)`
        : undefined,
    transition: isDragging.current
      ? "none"
      : closing
        ? "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)"
        : undefined,
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
          {comments.map((c) => {
            const likeState = commentLikes[c.id] ?? { liked: false, count: c.like_count };
            return (
              <div key={c.id} className="gallery-comment-item">
                {c.author_icon_image ? (
                  <img src={c.author_icon_image} className="gallery-comment-avatar gallery-comment-avatar-img" alt="" />
                ) : (
                  <div className="gallery-comment-avatar gallery-comment-avatar-default">
                    <span className="gallery-comment-avatar-head" />
                    <span className="gallery-comment-avatar-body" />
                  </div>
                )}
                <div className="gallery-comment-body">
                  <span className="gallery-comment-author">
                    {c.author_username
                      ? c.author_username
                      : c.author_email
                        ? maskEmail(c.author_email)
                        : "익명"}
                  </span>
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

        <div className="gallery-sheet-emoji-row">
          {["❤️","😍","🥰","😊","😂","🔥","✨","👍","🎉","💯","🙏","😭","💕","😎","🤩","👏","💪","🌟","😆","🥹","💖","😘","🫶","🤍","😁","🫠","😅","🤗","😇","🥲","😴","🤭","😋","🤔","😬","🥳","😤","😢","🤯","🫡"].map((emoji) => (
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

        <div className="gallery-sheet-input-row">
          <div className="gallery-comment-avatar gallery-comment-avatar-sm" />
          <input
            className="gallery-sheet-input"
            placeholder="회원님에 댓글을 남겨보세요."
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
