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
  const [followupOpenId, setFollowupOpenId] = useState<string | null>(null);
  const [followupContent, setFollowupContent] = useState("");
  const [followupSubmittingId, setFollowupSubmittingId] = useState<string | null>(null);

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
      if (followupOpenId === inquiry.id) {
        setFollowupOpenId(null);
        setFollowupContent("");
      }
      return;
    }

    setExpandedId(inquiry.id);
    setFollowupOpenId(null);
    setFollowupContent("");

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

  async function handleDeleteInquiry(inquiry: Inquiry) {
    try {
      setIsSubmitting(true);
      const response = await fetch(
        `/api/account/consulting/${inquiry.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete" }),
        }
      );

      if (response.ok) {
        setMessage("문의가 삭제되었습니다.");
        setExpandedId(null);
        await loadInquiries();
        window.dispatchEvent(new Event("notification-refresh"));
      }
    } catch (error) {
      console.error("Failed to delete inquiry:", error);
      setMessage("문의 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleFollowupInput(inquiryId: string) {
    if (followupOpenId === inquiryId) {
      setFollowupOpenId(null);
      setFollowupContent("");
      return;
    }

    setFollowupOpenId(inquiryId);
    setFollowupContent("");
    setMessage(null);
  }

  async function handleCreateFollowup(
    e: React.FormEvent,
    inquiry: Inquiry
  ) {
    e.preventDefault();
    if (!followupContent.trim()) return;

    try {
      setFollowupSubmittingId(inquiry.id);
      setMessage(null);

      const response = await fetch(`/api/account/consulting/${inquiry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "followup",
          content: followupContent.trim(),
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        setMessage(data.message ?? "추가문의 등록 중 오류가 발생했습니다.");
        return;
      }

      const data = (await response.json()) as {
        reply: InquiryReply;
        inquiry: Inquiry;
      };

      setRepliesMap((prev) => ({
        ...prev,
        [inquiry.id]: [...(prev[inquiry.id] ?? []), data.reply],
      }));
      setInquiries((prev) =>
        prev.map((it) =>
          it.id === inquiry.id
            ? {
                ...it,
                status: data.inquiry.status,
                updated_at: data.inquiry.updated_at,
                has_unread_reply: data.inquiry.has_unread_reply,
              }
            : it
        )
      );

      setFollowupOpenId(null);
      setFollowupContent("");
      setMessage("추가문의가 등록되었습니다.");
    } catch (error) {
      console.error("Failed to create followup inquiry:", error);
      setMessage("추가문의 등록 중 오류가 발생했습니다.");
    } finally {
      setFollowupSubmittingId(null);
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "접수완료";
      case "in_progress":
        return "답변대기";
      case "resolved":
        return "답변완료";
      case "closed":
        return "답변완료";
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
        return "consulting-status-resolved";
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
              문의하기
            </button>
          </div>

          {inquiries.length === 0 ? (
            <div className="consulting-empty">아직 등록된 문의가 없습니다.</div>
          ) : (
            <div className="consulting-items">
              {inquiries.map((inquiry) => {
                const isOpen = expandedId === inquiry.id;
                const inquiryStatus = inquiry.status as string;
                const isResolved = inquiryStatus === "resolved" || inquiryStatus === "closed";
                const replies = repliesMap[inquiry.id] ?? [];
                const useChatThread = isResolved || replies.length > 0;
                const canModify = inquiry.status === "pending" || inquiry.status === "in_progress";
                const isFollowupOpen = isOpen && followupOpenId === inquiry.id;
                const isFollowupSubmitting = followupSubmittingId === inquiry.id;

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
                        <div className="consulting-item-title-wrap">
                          <h4>{inquiry.title}</h4>
                          <span className="consulting-item-date">
                            {new Date(inquiry.created_at).toLocaleDateString("ko-KR")}
                          </span>
                        </div>
                        <div className="consulting-item-header-actions">
                          <span
                            className={`consulting-status ${getStatusClass(inquiry.status)}`}
                          >
                            {getStatusLabel(inquiry.status)}
                          </span>
                          {isResolved && (
                            <span
                              role="button"
                              tabIndex={0}
                              className="consulting-btn-followup-inline"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (!isOpen) {
                                  void toggleExpand(inquiry);
                                }
                                toggleFollowupInput(inquiry.id);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  if (!isOpen) {
                                    void toggleExpand(inquiry);
                                  }
                                  toggleFollowupInput(inquiry.id);
                                }
                              }}
                            >
                              {isFollowupOpen ? "문의취소" : "추가문의"}
                            </span>
                          )}
                        </div>
                      </div>
                      {inquiry.has_unread_reply && (
                        <span className="consulting-item-badge">답변 있음</span>
                      )}
                    </button>

                    {isOpen && (
                      <div className="consulting-item-body">
                        {useChatThread ? (
                          <div className="consulting-chat-thread">
                            <div className="consulting-chat-row consulting-chat-row-question">
                              <span className="consulting-chat-label">문의내용</span>
                              <div className="consulting-chat-bubble consulting-chat-bubble-question">
                                <p>{inquiry.content}</p>
                              </div>
                            </div>

                            {replies.map((reply) => (
                              <div
                                key={reply.id}
                                className={`consulting-chat-row ${
                                  reply.author_role === "admin"
                                    ? "consulting-chat-row-answer"
                                    : "consulting-chat-row-question"
                                }`}
                              >
                                <span className="consulting-chat-label">
                                  {reply.author_role === "admin"
                                    ? "관리자(답변)"
                                    : "문의자 추가질문"}
                                </span>
                                <div
                                  className={`consulting-chat-bubble ${
                                    reply.author_role === "admin"
                                      ? "consulting-chat-bubble-answer"
                                      : "consulting-chat-bubble-question"
                                  }`}
                                >
                                  <p>{reply.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
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
                          </>
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
                              onClick={() => handleDeleteInquiry(inquiry)}
                              disabled={isSubmitting}
                            >
                              {isSubmitting ? "처리 중..." : "문의 삭제"}
                            </button>
                          </div>
                        )}

                        <form
                          className={`consulting-followup-slide${isFollowupOpen ? " open" : ""}`}
                          onSubmit={(e) => handleCreateFollowup(e, inquiry)}
                        >
                          <div className="consulting-followup-inner">
                            <textarea
                              className="consulting-followup-input"
                              value={followupContent}
                              onChange={(e) => setFollowupContent(e.target.value)}
                              placeholder="추가문의를 입력해주세요"
                              rows={2}
                              disabled={!isFollowupOpen || isFollowupSubmitting}
                            />
                            <button
                              type="submit"
                              className="consulting-followup-submit"
                              disabled={
                                !isFollowupOpen ||
                                isFollowupSubmitting ||
                                !followupContent.trim()
                              }
                            >
                              {isFollowupSubmitting ? "등록 중..." : "등록"}
                            </button>
                          </div>
                        </form>
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
