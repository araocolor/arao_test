"use client";

import { useEffect, useState } from "react";
import { type Inquiry, type InquiryReply } from "@/lib/consulting";

type ConsultingSectionProps = {
  initialInquiries?: Inquiry[];
};

type View = "list" | "create" | "edit";

export function ConsultingSection({
  initialInquiries = [],
}: ConsultingSectionProps) {
  const [view, setView] = useState<View>("list");
  const [inquiries, setInquiries] = useState<Inquiry[]>(initialInquiries);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [repliesMap, setRepliesMap] = useState<Record<string, InquiryReply[]>>({});
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    loadInquiries();
  }, []);

  async function loadInquiries() {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/account/consulting?limit=100`);
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

  async function toggleExpand(inquiry: Inquiry) {
    if (expandedId === inquiry.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(inquiry.id);

    if (!repliesMap[inquiry.id]) {
      try {
        const response = await fetch(`/api/account/consulting/${inquiry.id}`);
        if (response.ok) {
          const data = (await response.json()) as {
            inquiry: Inquiry;
            replies: InquiryReply[];
          };
          setRepliesMap((prev) => ({ ...prev, [inquiry.id]: data.replies }));
          setInquiries((prev) =>
            prev.map((it) =>
              it.id === inquiry.id ? { ...it, has_unread_reply: false } : it
            )
          );
          window.dispatchEvent(new Event("notification-refresh"));
        }
      } catch (error) {
        console.error("Failed to load inquiry detail:", error);
      }
    }
  }

  async function handleCreateInquiry(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setMessage(null);

      const response = await fetch("/api/account/consulting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "consulting",
          title: formTitle,
          content: formContent,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        setMessage(data.message ?? "문의 등록 중 오류가 발생했습니다.");
        return;
      }

      setMessage("문의가 등록되었습니다.");
      setFormTitle("");
      setFormContent("");
      setView("list");
      await loadInquiries();
    } catch (error) {
      console.error("Failed to create inquiry:", error);
      setMessage("문의 등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEditInquiry(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInquiry) return;

    try {
      setIsSubmitting(true);
      setMessage(null);

      const response = await fetch(
        `/api/account/consulting/${selectedInquiry.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "edit",
            title: editTitle,
            content: editContent,
          }),
        }
      );

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        setMessage(data.message ?? "수정 중 오류가 발생했습니다.");
        return;
      }

      setMessage("수정이 완료되었습니다.");
      setView("list");
      await loadInquiries();
    } catch (error) {
      console.error("Failed to edit inquiry:", error);
      setMessage("수정 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCloseInquiry(inquiry: Inquiry) {
    try {
      setIsSubmitting(true);
      const response = await fetch(
        `/api/account/consulting/${inquiry.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "close" }),
        }
      );

      if (response.ok) {
        setMessage("문의가 종료되었습니다.");
        setExpandedId(null);
        await loadInquiries();
        window.dispatchEvent(new Event("notification-refresh"));
      }
    } catch (error) {
      console.error("Failed to close inquiry:", error);
      setMessage("문의 종료 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "답변대기중";
      case "in_progress":
        return "답변중";
      case "resolved":
        return "답변완료";
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
      {view === "list" && (
        <div className="consulting-list">
          <div className="consulting-header">
            <h3>1:1 문의 ({inquiries.length})</h3>
            <button
              className="consulting-btn-create"
              onClick={() => {
                setFormTitle("");
                setFormContent("");
                setMessage(null);
                setView("create");
              }}
            >
              + 새 문의
            </button>
          </div>

          {inquiries.length === 0 ? (
            <div className="consulting-empty">아직 등록된 문의가 없습니다.</div>
          ) : (
            <div className="consulting-items">
              {inquiries.map((inquiry) => {
                const isOpen = expandedId === inquiry.id;
                const replies = repliesMap[inquiry.id] ?? [];
                const canModify =
                  inquiry.status !== "closed" && inquiry.status !== "resolved";

                return (
                  <div
                    key={inquiry.id}
                    className={`consulting-item${isOpen ? " expanded" : ""}`}
                  >
                    <button
                      type="button"
                      className="consulting-item-summary"
                      onClick={() => toggleExpand(inquiry)}
                      aria-expanded={isOpen}
                    >
                      <div className="consulting-item-header">
                        <h4>{inquiry.title}</h4>
                        <span
                          className={`consulting-status ${getStatusClass(inquiry.status)}`}
                        >
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

                    {isOpen && (
                      <div className="consulting-item-body">
                        <div className="consulting-section-box">
                          <h4>문의 내용</h4>
                          <p>{inquiry.content}</p>
                        </div>

                        {replies.length > 0 && (
                          <div className="consulting-replies">
                            <h4>답변 ({replies.length})</h4>
                            {replies.map((reply) => (
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
                                    {reply.author_role === "admin"
                                      ? "관리자"
                                      : "고객"}
                                  </span>
                                  <span className="consulting-reply-date">
                                    {new Date(reply.created_at).toLocaleDateString(
                                      "ko-KR",
                                      {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      }
                                    )}
                                  </span>
                                </div>
                                <p>{reply.content}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {canModify && (
                          <div className="consulting-btn-group">
                            <button
                              className="consulting-btn-edit"
                              onClick={() => {
                                setSelectedInquiry(inquiry);
                                setEditTitle(inquiry.title);
                                setEditContent(inquiry.content);
                                setMessage(null);
                                setView("edit");
                              }}
                              disabled={isSubmitting}
                            >
                              수정
                            </button>
                            <button
                              className="consulting-btn-close"
                              onClick={() => handleCloseInquiry(inquiry)}
                              disabled={isSubmitting}
                            >
                              {isSubmitting ? "처리 중..." : "문의 종료"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === "create" && (
        <div className="consulting-create">
          <button className="consulting-btn-back" onClick={() => setView("list")}>
            ← 취소
          </button>

          <h3>새 문의 작성</h3>

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

            {message && <div className="consulting-message">{message}</div>}

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

      {view === "edit" && selectedInquiry && (
        <div className="consulting-create">
          <button className="consulting-btn-back" onClick={() => setView("list")}>
            ← 취소
          </button>

          <h3>문의 수정</h3>

          <form onSubmit={handleEditInquiry} className="consulting-form">
            <div className="consulting-form-group">
              <label>제목</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="제목을 입력해주세요"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="consulting-form-group">
              <label>내용</label>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="자세한 내용을 작성해주세요"
                rows={6}
                required
                disabled={isSubmitting}
              />
            </div>

            {message && <div className="consulting-message">{message}</div>}

            <button
              type="submit"
              className="consulting-btn-submit"
              disabled={isSubmitting || !editTitle.trim() || !editContent.trim()}
            >
              {isSubmitting ? "수정 중..." : "수정 완료"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
