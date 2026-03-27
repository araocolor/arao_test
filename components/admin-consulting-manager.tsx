"use client";

import { useEffect, useState } from "react";
import { type InquiryWithProfile, type InquiryReply } from "@/lib/consulting";

type View = "list" | "detail";

export function AdminConsultingManager() {
  const [view, setView] = useState<View>("list");
  const [type, setType] = useState<"consulting" | "general" | "all">("all");
  const [status, setStatus] = useState<string>("all");
  const [inquiries, setInquiries] = useState<InquiryWithProfile[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryWithProfile | null>(
    null
  );
  const [replies, setReplies] = useState<InquiryReply[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 목록 조회
  useEffect(() => {
    loadInquiries();
  }, [type, status]);

  async function loadInquiries() {
    try {
      setIsLoading(true);
      let url = "/api/admin/consulting?limit=50";

      if (type !== "all") {
        url += `&type=${type}`;
      }

      if (status !== "all") {
        url += `&status=${status}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = (await response.json()) as {
          inquiries: InquiryWithProfile[];
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
      const response = await fetch(`/api/admin/consulting/${inquiryId}`);
      if (response.ok) {
        const data = (await response.json()) as {
          inquiry: InquiryWithProfile;
          replies: InquiryReply[];
        };
        setSelectedInquiry(data.inquiry);
        setReplies(data.replies);
        setReplyContent("");
        setMessage(null);
        setView("detail");
      }
    } catch (error) {
      console.error("Failed to load inquiry detail:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // 답변 작성
  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInquiry || !replyContent.trim()) return;

    try {
      setIsSubmitting(true);
      const response = await fetch(
        `/api/admin/consulting/${selectedInquiry.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: replyContent }),
        }
      );

      if (response.ok) {
        setMessage("답변이 등록되었습니다.");
        setReplyContent("");
        await loadInquiryDetail(selectedInquiry.id);
      } else {
        const data = (await response.json()) as { message?: string };
        setMessage(data.message ?? "답변 등록 중 오류가 발생했습니다.");
      }
    } catch (error) {
      console.error("Failed to create reply:", error);
      setMessage("답변 등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // 상태 변경
  async function handleStatusChange(newStatus: string) {
    if (!selectedInquiry) return;

    try {
      const response = await fetch(
        `/api/admin/consulting/${selectedInquiry.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (response.ok) {
        setMessage("상태가 변경되었습니다.");
        await loadInquiryDetail(selectedInquiry.id);
        await loadInquiries();
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      setMessage("상태 변경 중 오류가 발생했습니다.");
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
        return "admin-consulting-status-pending";
      case "in_progress":
        return "admin-consulting-status-progress";
      case "resolved":
        return "admin-consulting-status-resolved";
      case "closed":
        return "admin-consulting-status-closed";
      default:
        return "";
    }
  };

  const pendingCount = inquiries.filter(
    (i) => i.status === "pending"
  ).length;
  const answeredCount = inquiries.filter(
    (i) => i.has_unread_reply && i.status === "in_progress"
  ).length;

  return (
    <div className="admin-consulting-manager">
      {view === "list" ? (
        <div className="admin-consulting-list">
          {/* 필터 */}
          <div className="admin-consulting-filters">
            <div className="admin-consulting-filter-group">
              <label>유형</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
              >
                <option value="all">전체</option>
                <option value="consulting">1:1 상담</option>
                <option value="general">일반 문의</option>
              </select>
            </div>

            <div className="admin-consulting-filter-group">
              <label>상태</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">전체</option>
                <option value="pending">접수</option>
                <option value="in_progress">답변중</option>
                <option value="resolved">완료</option>
                <option value="closed">종료</option>
              </select>
            </div>

            <div className="admin-consulting-stats">
              <span className="admin-consulting-stat">
                총 <strong>{inquiries.length}</strong>건
              </span>
              {pendingCount > 0 && (
                <span className="admin-consulting-stat pending">
                  접수됨 <strong>{pendingCount}</strong>건
                </span>
              )}
              {answeredCount > 0 && (
                <span className="admin-consulting-stat answered">
                  답변 <strong>{answeredCount}</strong>건
                </span>
              )}
            </div>
          </div>

          {/* 목록 */}
          {inquiries.length === 0 ? (
            <div className="admin-consulting-empty">
              조회된 상담/문의가 없습니다.
            </div>
          ) : (
            <div className="admin-consulting-items">
              <div className="admin-consulting-header-row">
                <div className="col-email">이메일</div>
                <div className="col-type">유형</div>
                <div className="col-title">제목</div>
                <div className="col-status">상태</div>
                <div className="col-date">접수일</div>
              </div>

              {inquiries.map((inquiry) => (
                <button
                  key={inquiry.id}
                  className="admin-consulting-item"
                  onClick={() => loadInquiryDetail(inquiry.id)}
                >
                  <div className="col-email">{inquiry.profile.email}</div>
                  <div className="col-type">
                    {inquiry.type === "consulting" ? "상담" : "문의"}
                  </div>
                  <div className="col-title">
                    {inquiry.title}
                    {inquiry.has_unread_reply && (
                      <span className="admin-consulting-badge">새로운</span>
                    )}
                  </div>
                  <div className="col-status">
                    <span
                      className={`admin-consulting-status ${getStatusClass(
                        inquiry.status
                      )}`}
                    >
                      {getStatusLabel(inquiry.status)}
                    </span>
                  </div>
                  <div className="col-date">
                    {new Date(inquiry.created_at).toLocaleDateString("ko-KR")}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        // 상세 뷰
        selectedInquiry && (
          <div className="admin-consulting-detail">
            <button
              className="admin-consulting-btn-back"
              onClick={() => setView("list")}
            >
              ← 목록으로
            </button>

            {/* 문의 정보 */}
            <div className="admin-consulting-detail-header">
              <div className="admin-consulting-detail-info">
                <h3>{selectedInquiry.title}</h3>
                <div className="admin-consulting-detail-meta">
                  <span className="meta-email">
                    📧 {selectedInquiry.profile.email}
                  </span>
                  <span className="meta-name">
                    👤 {selectedInquiry.profile.full_name ?? "이름 없음"}
                  </span>
                  <span className="meta-type">
                    {selectedInquiry.type === "consulting" ? "1:1 상담" : "일반 문의"}
                  </span>
                  <span
                    className={`meta-status admin-consulting-status ${getStatusClass(
                      selectedInquiry.status
                    )}`}
                  >
                    {getStatusLabel(selectedInquiry.status)}
                  </span>
                  <span className="meta-date">
                    {new Date(selectedInquiry.created_at).toLocaleDateString(
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
              </div>

              {/* 상태 변경 */}
              <div className="admin-consulting-status-controls">
                <label>상태 변경</label>
                <div className="admin-consulting-status-buttons">
                  {["pending", "in_progress", "resolved", "closed"].map(
                    (s) => (
                      <button
                        key={s}
                        className={`admin-consulting-status-btn ${
                          selectedInquiry.status === s ? "active" : ""
                        }`}
                        onClick={() =>
                          handleStatusChange(s as any)
                        }
                      >
                        {getStatusLabel(s)}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* 본문 */}
            <div className="admin-consulting-detail-content">
              <div className="admin-consulting-section">
                <h4>상담 내용</h4>
                <p>{selectedInquiry.content}</p>
              </div>

              {/* 답변 이력 */}
              {replies.length > 0 && (
                <div className="admin-consulting-replies">
                  <h4>답변 ({replies.length})</h4>
                  {replies.map((reply) => (
                    <div
                      key={reply.id}
                      className={`admin-consulting-reply ${
                        reply.author_role === "admin"
                          ? "admin-consulting-reply-admin"
                          : "admin-consulting-reply-customer"
                      }`}
                    >
                      <div className="admin-consulting-reply-meta">
                        <span className="reply-author">
                          {reply.author_role === "admin"
                            ? "📞 관리자 답변"
                            : "👤 고객"}
                        </span>
                        <span className="reply-date">
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

              {/* 답변 입력 */}
              <form
                onSubmit={handleReply}
                className="admin-consulting-reply-form"
              >
                <h4>답변 작성</h4>
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="답변을 작성해주세요"
                  rows={5}
                  disabled={isSubmitting}
                />

                {message && (
                  <div className="admin-consulting-message">{message}</div>
                )}

                <button
                  type="submit"
                  className="admin-consulting-btn-reply"
                  disabled={isSubmitting || !replyContent.trim()}
                >
                  {isSubmitting ? "등록 중..." : "답변 등록"}
                </button>
              </form>
            </div>
          </div>
        )
      )}
    </div>
  );
}
