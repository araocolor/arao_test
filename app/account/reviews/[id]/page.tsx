"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

export default function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { user } = useUser();
  const [id, setId] = useState("");
  const [review, setReview] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;

    const fetchReview = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/account/reviews/${id}`);
        if (!response.ok) throw new Error("후기 로드 실패");

        const data = await response.json();
        setReview(data.review);
        setReplies(data.replies);
        setLikeCount(data.review.like_count);
      } catch (err) {
        setError(err instanceof Error ? err.message : "오류 발생");
      } finally {
        setLoading(false);
      }
    };

    fetchReview();
  }, [id]);

  const handleToggleLike = async () => {
    try {
      const response = await fetch(`/api/account/reviews/${id}/likes`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("좋아요 실패");

      const data = await response.json();
      setLiked(data.liked);
      setLikeCount(data.like_count);
    } catch (err) {
      alert(err instanceof Error ? err.message : "오류 발생");
    }
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim()) return;

    try {
      setIsSubmittingReply(true);
      const response = await fetch(`/api/account/reviews/${id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyContent }),
      });

      if (!response.ok) throw new Error("답글 작성 실패");

      const newReply = await response.json();
      setReplies((prev) => [...prev, newReply]);
      setReplyContent("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "오류 발생");
    } finally {
      setIsSubmittingReply(false);
    }
  };

  if (loading) return <div className="admin-panel-card">로드 중...</div>;
  if (error) return <div className="admin-panel-card error-message">{error}</div>;
  if (!review) return <div className="admin-panel-card">후기를 찾을 수 없습니다.</div>;

  const isOwner = user?.emailAddresses[0]?.emailAddress === review.author_email;

  return (
    <div className="admin-panel-card stack">
      <p className="muted">Reviews</p>
      <h2>{review.title}</h2>

      <div className="review-meta">
        <span className="meta-item">카테고리: {review.category}</span>
        <span className="meta-item">작성자: {review.author_username || review.author_fullname || "익명"}</span>
        <span className="meta-item">
          날짜: {new Date(review.created_at).toLocaleDateString("ko-KR")}
        </span>
      </div>

      <div className="review-content">
        {review.content}
      </div>

      <div className="review-actions">
        <button
          onClick={handleToggleLike}
          className={`like-btn ${liked ? "liked" : ""}`}
        >
          ❤️ {likeCount}
        </button>

        {isOwner && (
          <>
            <button
              onClick={() => router.push(`/account/reviews/write?id=${id}`)}
              className="btn-secondary"
            >
              수정
            </button>
            <button
              onClick={async () => {
                if (confirm("삭제하시겠습니까?")) {
                  try {
                    const response = await fetch(`/api/account/reviews/${id}`, {
                      method: "DELETE",
                    });
                    if (!response.ok) throw new Error("삭제 실패");
                    router.push("/account/reviews");
                  } catch (err) {
                    alert(err instanceof Error ? err.message : "오류 발생");
                  }
                }
              }}
              className="btn-danger"
            >
              삭제
            </button>
          </>
        )}
      </div>

      {/* 답글 목록 */}
      <div className="review-replies">
        <h3>답글 ({replies.length})</h3>
        {replies.length === 0 ? (
          <p className="muted">답글이 없습니다.</p>
        ) : (
          <div className="replies-list">
            {replies.map((reply) => (
              <div key={reply.id} className="reply-item">
                <div className="reply-header">
                  <strong>{reply.author_username || "익명"}</strong>
                  <span className="reply-time">
                    {new Date(reply.created_at).toLocaleDateString("ko-KR")}
                  </span>
                </div>
                <p className="reply-content">{reply.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 답글 작성 폼 */}
      {user ? (
        <form onSubmit={handleSubmitReply} className="reply-form">
          <h3>답글 작성</h3>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="답글을 입력하세요"
            maxLength={1000}
            rows={4}
          />
          <div className="form-actions">
            <button
              type="submit"
              disabled={!replyContent.trim() || isSubmittingReply}
              className="btn-primary"
            >
              {isSubmittingReply ? "작성 중..." : "답글 작성"}
            </button>
          </div>
        </form>
      ) : (
        <p className="muted">답글을 작성하려면 로그인하세요.</p>
      )}
    </div>
  );
}
