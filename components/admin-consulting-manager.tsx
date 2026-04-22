"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type InquiryWithProfile, type InquiryReply } from "@/lib/consulting";

type View = "list" | "detail";
type SortField = "updated" | "created";
type SortOrder = "normal" | "reverse";

type AdminConsultingManagerProps = {
  onDetailViewChange?: (isDetail: boolean) => void;
  forceListToken?: number;
};

export function AdminConsultingManager({
  onDetailViewChange,
  forceListToken = 0,
}: AdminConsultingManagerProps) {
  const [view, setView] = useState<View>("list");
  const [status, setStatus] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("updated");
  const [sortOrder, setSortOrder] = useState<SortOrder>("normal");
  const [inquiries, setInquiries] = useState<InquiryWithProfile[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryWithProfile | null>(
    null
  );
  const [replies, setReplies] = useState<InquiryReply[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editReplyContent, setEditReplyContent] = useState("");
  const [replyActionLoadingId, setReplyActionLoadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchField, setSearchField] = useState<"id" | "email" | "title" | "content">("title");
  const [period, setPeriod] = useState<"today" | "week" | "month" | "year">("year");
  const detailThreadRef = useRef<HTMLDivElement | null>(null);

  // 목록 조회 - 초기 로드 및 타입/상태 변경 시
  useEffect(() => {
    loadInquiries();
  }, [status]);

  useEffect(() => {
    onDetailViewChange?.(view === "detail");
  }, [view, onDetailViewChange]);

  useEffect(() => {
    if (view !== "detail") return;

    setView("list");
    setSelectedInquiry(null);
    setReplies([]);
    setMessage(null);
    setEditingReplyId(null);
    setEditReplyContent("");
    setReplyActionLoadingId(null);
  }, [forceListToken]);

  useEffect(() => {
    if (view !== "detail") return;
    const container = detailThreadRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [view, selectedInquiry?.id, replies.length]);

  async function loadInquiries() {
    try {
      setIsLoading(true);
      let url = "/api/admin/consulting?limit=50";

      if (status !== "all") {
        url += `&status=${status}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = (await response.json()) as {
          inquiries: InquiryWithProfile[];
          total: number;
        };
        console.log("✅ Inquiries loaded:", {
          url,
          count: data.inquiries.length,
          total: data.total,
          data: data.inquiries,
        });
        setInquiries(data.inquiries);
      } else {
        const errorData = (await response.json()) as { message?: string };
        console.error("❌ Failed to load inquiries:", response.status, errorData.message);
        setInquiries([]);
      }
    } catch (error) {
      console.error("Failed to load inquiries:", error);
      setInquiries([]);
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
        setInquiries((prev) =>
          prev.map((inquiry) =>
            inquiry.id === data.inquiry.id
              ? { ...inquiry, status: data.inquiry.status, updated_at: data.inquiry.updated_at }
              : inquiry
          )
        );
        setReplies(data.replies);
        setReplyContent("");
        setEditingReplyId(null);
        setEditReplyContent("");
        setReplyActionLoadingId(null);
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

  function startEditReply(reply: InquiryReply) {
    setEditingReplyId(reply.id);
    setEditReplyContent(reply.content);
    setMessage(null);
  }

  function cancelEditReply() {
    setEditingReplyId(null);
    setEditReplyContent("");
  }

  async function handleUpdateReply(replyId: string) {
    if (!selectedInquiry || !editReplyContent.trim()) return;

    try {
      setReplyActionLoadingId(replyId);
      const response = await fetch(
        `/api/admin/consulting/${selectedInquiry.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reply-edit",
            replyId,
            content: editReplyContent,
          }),
        }
      );

      if (response.ok) {
        setMessage("답변이 수정되었습니다.");
        setEditingReplyId(null);
        setEditReplyContent("");
        await loadInquiryDetail(selectedInquiry.id);
      } else {
        const data = (await response.json()) as { message?: string };
        setMessage(data.message ?? "답변 수정 중 오류가 발생했습니다.");
      }
    } catch (error) {
      console.error("Failed to update reply:", error);
      setMessage("답변 수정 중 오류가 발생했습니다.");
    } finally {
      setReplyActionLoadingId(null);
    }
  }

  async function handleDeleteReply(replyId: string) {
    if (!selectedInquiry) return;
    const isConfirmed = window.confirm("이 답변을 삭제할까요?");
    if (!isConfirmed) return;

    try {
      setReplyActionLoadingId(replyId);
      const response = await fetch(
        `/api/admin/consulting/${selectedInquiry.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reply-delete",
            replyId,
          }),
        }
      );

      if (response.ok) {
        setMessage("답변이 삭제되었습니다.");
        if (editingReplyId === replyId) {
          setEditingReplyId(null);
          setEditReplyContent("");
        }
        await loadInquiryDetail(selectedInquiry.id);
      } else {
        const data = (await response.json()) as { message?: string };
        setMessage(data.message ?? "답변 삭제 중 오류가 발생했습니다.");
      }
    } catch (error) {
      console.error("Failed to delete reply:", error);
      setMessage("답변 삭제 중 오류가 발생했습니다.");
    } finally {
      setReplyActionLoadingId(null);
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
        return "admin-consulting-status-pending";
      case "in_progress":
        return "admin-consulting-status-progress";
      case "resolved":
        return "admin-consulting-status-resolved";
      case "closed":
        return "admin-consulting-status-resolved";
      default:
        return "";
    }
  };

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("ko-KR");

  const formatDateTime = (value: string) =>
    new Date(value).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const sortedInquiries = useMemo(() => {
    const sorted = [...inquiries].sort((a, b) => {
      const aTime = new Date(
        sortField === "updated" ? a.updated_at : a.created_at
      ).getTime();
      const bTime = new Date(
        sortField === "updated" ? b.updated_at : b.created_at
      ).getTime();

      return bTime - aTime;
    });

    if (sortOrder === "reverse") {
      sorted.reverse();
    }

    const now = new Date();
    const periodFiltered = sorted.filter((i) => {
      const created = new Date(i.created_at);
      if (period === "today") {
        return created.toDateString() === now.toDateString();
      }
      if (period === "week") {
        return now.getTime() - created.getTime() <= 7 * 24 * 60 * 60 * 1000;
      }
      if (period === "month") {
        return now.getTime() - created.getTime() <= 30 * 24 * 60 * 60 * 1000;
      }
      return true;
    });

    if (!searchQuery.trim()) return periodFiltered;

    const q = searchQuery.trim().toLowerCase();
    return periodFiltered.filter((i) => {
      if (searchField === "id") return i.profile.email.split("@")[0].toLowerCase().includes(q);
      if (searchField === "email") return i.profile.email.toLowerCase().includes(q);
      if (searchField === "title") return i.title.toLowerCase().includes(q);
      if (searchField === "content") return i.content.toLowerCase().includes(q);
      return true;
    });
  }, [inquiries, sortField, sortOrder, searchQuery, searchField, period]);

  const handleSortClick = (nextField: SortField) => {
    if (sortField === nextField) {
      setSortOrder((prev) => (prev === "normal" ? "reverse" : "normal"));
      return;
    }

    setSortField(nextField);
    setSortOrder("normal");
  };

  const pendingCount = inquiries.filter(
    (i) => i.status === "pending"
  ).length;
  const answeredCount = inquiries.filter(
    (i) => i.has_unread_reply && i.status === "resolved"
  ).length;

  return (
    <div className="admin-consulting-manager">
      {view === "list" ? (
        <div className="admin-consulting-list">
          {/* 필터 */}
          <div className="admin-consulting-filter-line">
              <div className="admin-consulting-filter-group admin-consulting-filter-period">
                <select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}>
                  <option value="today">today</option>
                  <option value="week">week</option>
                  <option value="month">month</option>
                  <option value="year">year</option>
                </select>
              </div>

              <div className="admin-consulting-filter-group admin-consulting-filter-status">
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="all">전체</option>
                  <option value="pending">접수완료</option>
                  <option value="resolved">답변완료</option>
                  <option value="unread">읽지않음</option>
                </select>
              </div>

              <div className="admin-consulting-filter-group admin-consulting-filter-progress">
                <button
                  type="button"
                  className={`admin-consulting-inline-filter-btn ${
                    status === "in_progress" ? "active" : ""
                  }`}
                  onClick={() =>
                    setStatus((prev) => (prev === "in_progress" ? "all" : "in_progress"))
                  }
                  aria-pressed={status === "in_progress"}
                >
                  답변대기
                </button>
              </div>

              <div className="admin-consulting-filter-group admin-consulting-filter-sort">
                <div className="admin-consulting-sort-buttons">
                  <button
                    type="button"
                    className={`admin-consulting-sort-btn ${
                      sortField === "updated" ? "active" : ""
                    }`}
                    onClick={() => handleSortClick("updated")}
                    aria-pressed={sortField === "updated"}
                  >
                    수정순 {sortField === "updated" ? (sortOrder === "normal" ? "↑" : "↓") : ""}
                  </button>
                  <button
                    type="button"
                    className={`admin-consulting-sort-btn ${
                      sortField === "created" ? "active" : ""
                    }`}
                    onClick={() => handleSortClick("created")}
                    aria-pressed={sortField === "created"}
                  >
                    시간순 {sortField === "created" ? (sortOrder === "normal" ? "↑" : "↓") : ""}
                  </button>
                </div>
              </div>
          </div>

          <div className="admin-consulting-stats">
              <span className="admin-consulting-stat">
                총 <strong>{inquiries.length}</strong>건
              </span>
              {pendingCount > 0 && (
                <span className="admin-consulting-stat pending">
                  접수완료 <strong>{pendingCount}</strong>건
                </span>
              )}
              {answeredCount > 0 && (
                <span className="admin-consulting-stat answered">
                  답변 <strong>{answeredCount}</strong>건
                </span>
              )}
          </div>

          {/* 목록 */}
          {sortedInquiries.length === 0 ? (
            <div className="admin-consulting-empty">
              조회된 상담/문의가 없습니다.
            </div>
          ) : (
            <div className="admin-consulting-items">
              {sortedInquiries.map((inquiry) => {
                const writerId =
                  inquiry.profile.email.split("@")[0] ||
                  inquiry.profile.full_name?.trim() ||
                  inquiry.profile.email;
                const hasUpdatedAt =
                  new Date(inquiry.updated_at).getTime() -
                    new Date(inquiry.created_at).getTime() >
                  1000;

                return (
                  <button
                    key={inquiry.id}
                    className="admin-consulting-item"
                    onClick={() => loadInquiryDetail(inquiry.id)}
                  >
                    <div className="admin-consulting-item-top">
                      <span className="admin-consulting-item-writer">
                        {inquiry.profile.icon_image ? (
                          <img
                            src={inquiry.profile.icon_image}
                            alt=""
                            className="admin-consulting-item-writer-avatar"
                          />
                        ) : (
                          <span className="admin-consulting-item-writer-icon">👤</span>
                        )}
                        <span className="admin-consulting-item-writer-id">{writerId}</span>
                      </span>
                      {inquiry.has_unread_reply && (
                        <span className="admin-consulting-badge">읽지않음</span>
                      )}
                      <span
                        className={`admin-consulting-status ${getStatusClass(
                          inquiry.status
                        )}`}
                      >
                        {getStatusLabel(inquiry.status)}
                      </span>
                    </div>

                    <div className="admin-consulting-item-bottom">
                      <span className="admin-consulting-item-title">{inquiry.title}</span>
                      <span className="admin-consulting-item-meta">
                        {hasUpdatedAt && (
                          <>
                            <span className="admin-consulting-item-meta-updated">
                              {formatDate(inquiry.updated_at)}
                            </span>
                            <span className="admin-consulting-item-meta-sep">|</span>
                          </>
                        )}
                        <span className="admin-consulting-item-meta-created">
                          {formatDate(inquiry.created_at)}
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* 하단 고정 검색 푸터 */}
          <div className="admin-consulting-search-footer">
            <select
              className="admin-consulting-search-field"
              value={searchField}
              onChange={(e) => setSearchField(e.target.value as typeof searchField)}
            >
              <option value="id">아이디</option>
              <option value="email">이메일</option>
              <option value="title">제목</option>
              <option value="content">본문</option>
            </select>
            <input
              className="admin-consulting-search-input"
              type="text"
              placeholder="검색어 입력"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="admin-consulting-search-clear"
                onClick={() => setSearchQuery("")}
                type="button"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      ) : (
        // 상세 뷰
        selectedInquiry && (
          <div className="admin-consulting-detail">
            {/* 1줄: 아바타 + 아이디 | 이메일 + 상태 */}
            <div className="admin-consulting-detail-row1">
              <div className="admin-consulting-detail-user">
                {selectedInquiry.profile.icon_image ? (
                  <img
                    src={selectedInquiry.profile.icon_image}
                    alt=""
                    className="admin-consulting-detail-avatar"
                  />
                ) : (
                  <span className="admin-consulting-detail-avatar-icon">👤</span>
                )}
                <span className="admin-consulting-detail-userid">
                  {selectedInquiry.profile.email.split("@")[0] || selectedInquiry.profile.full_name || selectedInquiry.profile.email}
                </span>
                <span className="admin-consulting-detail-sep">|</span>
                <span className="admin-consulting-detail-email">{selectedInquiry.profile.email}</span>
              </div>
              <span className={`admin-consulting-status ${getStatusClass(selectedInquiry.status)}`}>
                {getStatusLabel(selectedInquiry.status)}
              </span>
            </div>

            {/* 2줄: 제목 + 날짜 */}
            {(() => {
              const hasUpdated = new Date(selectedInquiry.updated_at).getTime() - new Date(selectedInquiry.created_at).getTime() > 1000;
              return (
                <div className="admin-consulting-detail-row2">
                  <span className="admin-consulting-detail-title">{selectedInquiry.title}</span>
                  <span className="admin-consulting-detail-dates">
                    <span className="admin-consulting-detail-date-created">
                      {formatDate(selectedInquiry.created_at)}
                    </span>
                    {hasUpdated && (
                      <span className="admin-consulting-detail-date-updated">
                        수정 {formatDate(selectedInquiry.updated_at)}
                      </span>
                    )}
                  </span>
                </div>
              );
            })()}

            {/* 본문 */}
            <div className="admin-consulting-detail-content">
              {/* 상태 버튼 */}
              <div className="admin-consulting-status-buttons">
                {["pending", "in_progress", "resolved"].map((s) => (
                  <button
                    key={s}
                    className={`admin-consulting-status-btn ${selectedInquiry.status === s ? "active" : ""}`}
                    onClick={() => handleStatusChange(s as any)}
                    disabled={s === "resolved" || (replies.length > 0 && s !== "resolved")}
                    title={s === "resolved" ? "답변 작성 시 자동 완료됩니다." : replies.length > 0 ? "답변 등록 후 변경할 수 없습니다." : undefined}
                  >
                    {getStatusLabel(s)}
                  </button>
                ))}
              </div>

              {message && (
                <div className="admin-consulting-message">{message}</div>
              )}

              <div className="admin-consulting-chat-layout">
                <div className="admin-consulting-chat-scroll" ref={detailThreadRef}>
                  <div className="admin-consulting-chat-row admin-consulting-chat-row-question">
                    <span className="admin-consulting-chat-label">문의내용</span>
                    <div className="admin-consulting-chat-bubble admin-consulting-chat-bubble-question">
                      <p>{selectedInquiry.content}</p>
                    </div>
                  </div>

                  {replies.length === 0 ? (
                    <div className="admin-consulting-chat-row admin-consulting-chat-row-answer">
                      <span className="admin-consulting-chat-label">관리자(답변)</span>
                      <div
                        className="admin-consulting-chat-bubble admin-consulting-chat-bubble-answer admin-consulting-chat-bubble-empty"
                        aria-hidden="true"
                      />
                    </div>
                  ) : (
                    replies.map((reply) => {
                      const isAdminReply = reply.author_role === "admin";
                      const isEditing = editingReplyId === reply.id;
                      return (
                        <div
                          key={reply.id}
                          className={`admin-consulting-chat-row ${
                            isAdminReply
                              ? "admin-consulting-chat-row-answer"
                              : "admin-consulting-chat-row-question"
                          }${isEditing ? " admin-consulting-chat-row-editing" : ""}`}
                        >
                          <span className="admin-consulting-chat-label">
                            {isAdminReply ? "관리자(답변)" : "문의자 추가글"}
                          </span>
                          <div
                            className={`admin-consulting-chat-bubble ${
                              isAdminReply
                                ? "admin-consulting-chat-bubble-answer"
                                : "admin-consulting-chat-bubble-question"
                            }${isEditing ? " admin-consulting-chat-bubble-editing" : ""}`}
                          >
                            <div className="admin-consulting-reply-meta">
                              <span className="reply-date">{formatDateTime(reply.created_at)}</span>
                            </div>

                            {isEditing ? (
                              <div className="admin-consulting-reply-edit">
                                <textarea
                                  value={editReplyContent}
                                  onChange={(e) => setEditReplyContent(e.target.value)}
                                  rows={3}
                                  disabled={replyActionLoadingId === reply.id}
                                />
                                <div className="admin-consulting-reply-actions">
                                  <button
                                    type="button"
                                    className="admin-consulting-reply-action-btn"
                                    onClick={cancelEditReply}
                                    disabled={replyActionLoadingId === reply.id}
                                  >
                                    취소
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-consulting-reply-action-btn primary"
                                    onClick={() => handleUpdateReply(reply.id)}
                                    disabled={
                                      replyActionLoadingId === reply.id ||
                                      !editReplyContent.trim()
                                    }
                                  >
                                    {replyActionLoadingId === reply.id ? "저장 중..." : "저장"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p>{reply.content}</p>
                                {isAdminReply && (
                                  <div className="admin-consulting-reply-actions">
                                    <button
                                      type="button"
                                      className="admin-consulting-reply-action-btn"
                                      onClick={() => startEditReply(reply)}
                                      disabled={replyActionLoadingId === reply.id}
                                    >
                                      수정
                                    </button>
                                    <button
                                      type="button"
                                      className="admin-consulting-reply-action-btn danger"
                                      onClick={() => handleDeleteReply(reply.id)}
                                      disabled={replyActionLoadingId === reply.id}
                                    >
                                      {replyActionLoadingId === reply.id ? "삭제 중..." : "삭제"}
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* 답변 입력 */}
                <form
                  onSubmit={handleReply}
                  className="admin-consulting-reply-form"
                >
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="답변을 작성해주세요"
                    rows={3}
                    disabled={isSubmitting}
                  />

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
          </div>
        )
      )}
    </div>
  );
}
