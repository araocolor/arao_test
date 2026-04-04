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
  isMine?: boolean;
  likeCount: number;
  liked: boolean;
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
      return (data.comments ?? []).map((comment) => ({ ...comment, parentId: comment.parentId ?? null, likeCount: comment.likeCount ?? 0, liked: comment.liked ?? false }));
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

export function UserContentInteractions({ reviewId, reviewAuthorId }: { reviewId: string; reviewAuthorId?: string | null }) {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const cachedComments = getCommentsCache(reviewId);
  const [comments, setComments] = useState<Comment[]>(cachedComments ?? []);
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyContext | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");
  const editTextareaElRef = useRef<HTMLTextAreaElement>(null);
  const [menuComment, setMenuComment] = useState<Comment | null>(null);
  const [menuParentId, setMenuParentId] = useState<string | null>(null);

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
      .catch(() => {});
  }, [reviewId]);

  function editRows(text: string) {
    return Math.max(text.split("\n").length, 1);
  }

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
    const res = await fetch(`/api/main/user-review/${reviewId}/comments/${commentId}/likes`, { method: "POST" });
    if (res.ok) {
      const d = await res.json() as { liked: boolean; likeCount: number };
      setComments((prev) => {
        const next = prev.map((c) => c.id === commentId ? { ...c, liked: d.liked, likeCount: d.likeCount } : c);
        setCommentsCache(next);
        return next;
      });
    }
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
        setComments((prev) => {
          const next = prev.map((c) => c.id === commentId ? { ...c, isDeleted: true, content: "삭제된 댓글입니다." } : c);
          setCommentsCache(next);
          return next;
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const rootComments = comments.filter((comment) => !comment.parentId);
  const getReplies = (parentId: string) => comments.filter((comment) => comment.parentId === parentId);
  const isReviewAuthor = (authorId: string) => !!reviewAuthorId && authorId === reviewAuthorId;

  return (
    <section className="user-content-comment-section">
      <p className="user-content-comment-label">댓글 {comments.length > 0 ? comments.length : ""}</p>

      {/* 댓글 목록 */}
      {comments.length > 0 && (
        <div className="user-content-comment-thread-list">
          {rootComments.map((comment) => (
            <div key={comment.id} className="user-content-comment-thread">
              <div className={`user-content-comment-item${comment.isMine ? " is-mine" : ""}`}>
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
                        onClick={() => { setMenuComment(comment); setMenuParentId(comment.id); }}
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
                        onClick={() => setReplyTo({ target: comment, parentId: comment.id })}
                      >
                        답글
                      </button>
                    )}
                    <button
                      type="button"
                      className="user-content-comment-like-btn"
                      onClick={() => handleLikeComment(comment.id)}
                      aria-label="좋아요"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill={comment.liked ? "#E02424" : "none"} stroke={comment.liked ? "#E02424" : "currentColor"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                      {comment.likeCount > 0 && <span>{comment.likeCount}</span>}
                    </button>
                  </div>
                </div>
              </div>

              <div className="user-content-comment-replies">
                {getReplies(comment.id).map((reply) => (
                  <div key={reply.id} className={`user-content-comment-item is-reply${reply.isMine ? " is-mine" : ""}`}>
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
                              onClick={() => { setMenuComment(reply); setMenuParentId(comment.id); }}
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
                            onClick={() => setReplyTo({ target: reply, parentId: comment.id })}
                          >
                            답글
                          </button>
                        )}
                        <button
                          type="button"
                          className="user-content-comment-like-btn"
                          onClick={() => handleLikeComment(reply.id)}
                          aria-label="좋아요"
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
          <button type="button" onClick={() => setReplyTo(null)}>
            취소
          </button>
        </div>
      )}

      {/* 댓글 입력폼 */}
      <div className="user-content-comment-form">
        <textarea
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
          등록
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
