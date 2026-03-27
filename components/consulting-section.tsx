"use client";

import { useEffect, useState } from "react";
import { type Inquiry, type InquiryReply } from "@/lib/consulting";

type ConsultingSectionProps = {
  initialInquiries?: Inquiry[];
};

type View = "list" | "detail" | "create";

export function ConsultingSection({
  initialInquiries = [],
}: ConsultingSectionProps) {
  const [view, setView] = useState<View>("list");
  const [type, setType] = useState<"consulting" | "general">("consulting");
  const [inquiries, setInquiries] = useState<Inquiry[]>(initialInquiries);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [replies, setReplies] = useState<InquiryReply[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 폼 상태
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 목록 조회
  useEffect(() => {
    loadInquiries();
  }, [type]);

  async function loadInquiries() {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/account/consulting?type=${type}&limit=20`
      );
      if (response.ok) {
        const data = (await response.json()) as {
          inquiries: Inquiry[];
          total: number;
        };
        setInquiries(data.inquiries);
      }
    } catch (error) {
      console.error("Failed to load inquiries:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // 상세 조회
  async function loadInquiryDetail(inquiryId: string) {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/account/consulting/${inquiryId}`);
      if (response.ok) {
        const data = (await response.json()) as {
          inquiry: Inquiry;
          replies: InquiryReply[];
        };
        setSelectedInquiry(data.inquiry);
        setReplies(data.replies);
        setView("detail");
      }
    } catch (error) {
      console.error("Failed to load inquiry detail:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // 상담 작성
  async function handleCreateInquiry(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setMessage(null);

      const response = await fetch("/api/account/consulting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: formTitle,
          content: formContent,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        setMessage(data.message ?? "상담 등록 중 오류가 발생했습니다.");
        return;
      }

      setMessage("상담이 등록되었습니다.");
      setFormTitle("");
      setFormContent("");
      setView("list");
      await loadInquiries();
    } catch (error) {
      console.error("Failed to create inquiry:", error);
      setMessage("상담 등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // 상담 종료
  async function handleCloseInquiry() {
    if (!selectedInquiry) return;

    try {
      setIsSubmitting(true);
      const response = await fetch(
        `/api/account/consulting/${selectedInquiry.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "close" }),
        }
      );

      if (response.ok) {
        setMessage("상담이 종료되었습니다.");
        setView("list");
        await loadInquiries();
      }
    } catch (error) {
      console.error("Failed to close inquiry:", error);
      setMessage("상담 종료 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "접수";
      case "in_progress":
        return "답변중";
      case "resolved":
        return "완료";
      case "closed":
        return "종료";
      default:
        return status;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "pending":
        return "consulting-status-pending";
      case "in_progress":
        return "consulting-status-progress";
      case "resolved":
        return "consulting-status-resolved";
      case "closed":
        return "consulting-status-closed";
      default:
        return "";
    }
  };

  return (
    <div className="consulting-section">
      {/* 탭 */}
      <div className="consulting-tabs">
        <button
          className={`consulting-tab ${type === "consulting" ? "active" : ""}`}
          onClick={() => {
            setType("consulting");
            setView("list");
          }}
        >
          1:1 상담
        </button>
        <button
          className={`consulting-tab ${type === "general" ? "active" : ""}`}
          onClick={() => {
            setType("general");
            setView("list");
          }}
        >
          일반 문의
        </button>
      </div>

      {/* 목록 뷰 */}
      {view === "list" && (
        <div className="consulting-list">
          <div className="consulting-header">
            <h3>
              {type === "consulting" ? "1:1 상담" : "일반 문의"} (
              {inquiries.length})
            </h3>
            <button
              className="consulting-btn-create"
              onClick={() => {
                setFormTitle("");
                setFormContent("");
                setView("create");
              }}
            >
              + 새로 작성
            </button>
          </div>

          {inquiries.length === 0 ? (
            <div className="consulting-empty">
              아직 등록된 {type === "consulting" ? "상담" : "문의"}이 없습니다.
            </div>
          ) : (
            <div className="consulting-items">
              {inquiries.map((inquiry) => (
                <button
                  key={inquiry.id}
                  className="consulting-item"
                  onClick={() => loadInquiryDetail(inquiry.id)}
                >
                  <div className="consulting-item-header">
                    <h4>{inquiry.title}</h4>
                    <span className={`consulting-status ${getStatusClass(inquiry.status)}`}>
                      {getStatusLabel(inquiry.status)}
                    </span>
                  </div>
                  <p className="consulting-item-date">
                    {new Date(inquiry.created_at).toLocaleDateString("ko-KR")}
                  </p>
                  {inquiry.has_unread_reply && (
                    <span className="consulting-item-badge">답변 있음</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 상세 뷰 */}
      {view === "detail" && selectedInquiry && (
        <div className="consulting-detail">
          <button className="consulting-btn-back" onClick={() => setView("list")}>
            ← 목록으로 돌아가기
          </button>

          <div className="consulting-detail-header">
            <div>
              <h3>{selectedInquiry.title}</h3>
              <p className="consulting-detail-meta">
                {new Date(selectedInquiry.created_at).toLocaleDateString(
                  "ko-KR",
                  {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                )}{" "}
                • <span className={`consulting-status ${getStatusClass(selectedInquiry.status)}`}>
                  {getStatusLabel(selectedInquiry.status)}
                </span>
              </p>
            </div>
          </div>

          <div className="consulting-detail-content">
            <div className="consulting-section-box">
              <h4>상담 내용</h4>
              <p>{selectedInquiry.content}</p>
            </div>

            {replies.length > 0 && (
              <div className="consulting-replies">
                <h4>답변 ({replies.length})</h4>
                {replies.map((reply, index) => (
                  <div
                    key={reply.id}
                    className={`consulting-reply ${
                      reply.author_role === "admin"
                        ? "consulting-reply-admin"
                        : "consulting-reply-customer"
                    }`}
                  >
                    <div className="consulting-reply-meta">
                      <span className="consulting-reply-author">
                        {reply.author_role === "admin" ? "📞 관리자" : "👤 고객"}
                      </span>
                      <span className="consulting-reply-date">
                        {new Date(reply.created_at).toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p>{reply.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedInquiry.status !== "closed" && (
            <button
              className="consulting-btn-close"
              onClick={handleCloseInquiry}
              disabled={isSubmitting}
            >
              {isSubmitting ? "처리 중..." : "상담 종료"}
            </button>
          )}
        </div>
      )}

      {/* 작성 폼 */}
      {view === "create" && (
        <div className="consulting-create">
          <button className="consulting-btn-back" onClick={() => setView("list")}>
            ← 취소
          </button>

          <h3>
            새 {type === "consulting" ? "상담" : "문의"} 작성
          </h3>

          <form onSubmit={handleCreateInquiry} className="consulting-form">
            <div className="consulting-form-group">
              <label>제목</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="제목을 입력해주세요"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="consulting-form-group">
              <label>내용</label>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="자세한 내용을 작성해주세요"
                rows={6}
                required
                disabled={isSubmitting}
              />
            </div>

            {message && (
              <div className="consulting-message">{message}</div>
            )}

            <button
              type="submit"
              className="consulting-btn-submit"
              disabled={isSubmitting || !formTitle.trim() || !formContent.trim()}
            >
              {isSubmitting ? "등록 중..." : "등록"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
