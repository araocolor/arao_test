"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { type NotificationItem } from "@/lib/notifications";

type NotificationDrawerProps = {
  isOpen: boolean;
  isMounted: boolean;
  items: NotificationItem[];
  isLoading?: boolean;
  username: string | null;
  email: string | null;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onRollbackRead: (id: string) => void;
};

function appendQueryParam(link: string, key: string, value: string): string {
  const [beforeHash, hash = ""] = link.split("#", 2);
  const separator = beforeHash.includes("?") ? "&" : "?";
  const next = `${beforeHash}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  return hash ? `${next}#${hash}` : next;
}

function hasQueryParam(link: string, key: string): boolean {
  try {
    const url = new URL(link, "https://arao.local");
    return url.searchParams.has(key);
  } catch {
    return link.includes(`${key}=`);
  }
}

function getCommentIdFromSourceId(item: NotificationItem): string | null {
  if (item.type !== "review_comment" && item.type !== "review_comment_like") return null;
  const sourceId = typeof item.source_id === "string" ? item.source_id.trim() : "";
  if (!sourceId) return null;
  const parts = sourceId.split(":");
  if (parts.length < 2) return null;
  const candidate = parts[1]?.trim();
  return candidate && candidate.length > 0 ? candidate : null;
}

function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex < 0) return email;
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  return `${local.slice(0, 2)}***${domain}`;
}

// 알림 제목에서 "{이름}님이" 앞부분을 bold 처리
function formatTitle(title: string): React.ReactNode {
  const t = title.endsWith(".") ? title : title + ".";
  const idx = t.indexOf("님이");
  if (idx <= 0) return t;
  const name = t.slice(0, idx);
  const maskedName = name.includes("@") ? maskEmail(name) : name;
  const rest = t.slice(idx);
  return <><strong>{maskedName}</strong>{rest}</>;
}

function getSenderName(title: string): string | null {
  const idx = title.indexOf("님이");
  if (idx <= 0) return null;
  const name = title.slice(0, idx).trim();
  return name || null;
}

// 상대 시간 포맷 함수
function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return `${seconds}초전`;
  if (minutes < 60) return `${minutes}분전`;
  if (hours < 24) return `${hours}시간전`;

  const remainingHours = hours % 24;
  if (days < 30) {
    return remainingHours > 0
      ? `${days}일 ${remainingHours}시간전`
      : `${days}일전`;
  }

  // 30일 이상은 날짜로 표시
  return new Date(isoString).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

// 알림 타입별 라벨 매핑
const TYPE_LABEL: Record<string, string> = {
  settings: "계정 설정",
  order_shipped: "주문 발송",
  order_cancelled: "결제 취소",
  consulting: "1:1 상담",
  review_reply: "사용자 후기",
  review_like: "사용자 후기",
  review_comment: "사용자 후기",
  review_comment_like: "사용자 후기",
  gallery_like: "갤러리",
  gallery_reply: "갤러리",
  gallery_comment_deleted: "갤러리",
};

// 알림 타입별 아이콘 이모지
const TYPE_ICON: Record<string, string> = {
  settings: "⚙️",
  order_shipped: "📦",
  order_cancelled: "⚠️",
  consulting: "💬",
  review_reply: "📝",
  review_like: "❤️",
  review_comment: "💬",
  review_comment_like: "❤️",
  gallery_like: "❤️",
  gallery_reply: "💬",
  gallery_comment_deleted: "🗑️",
};

export function NotificationDrawer({
  isOpen,
  isMounted,
  items,
  isLoading = false,
  username,
  email,
  onClose,
  onMarkRead,
  onRollbackRead,
}: NotificationDrawerProps) {
  const [optimisticReadIds, setOptimisticReadIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.body);
    return () => setPortalTarget(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setExpanded(false);
      return;
    }
    // 알림창 열릴 때 배경 스크롤 차단
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleOutsideClick(e: MouseEvent | TouchEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [isOpen, onClose]);

  if (!isMounted || !portalTarget) return null;
  const headerDisplayName = username || (email ? maskEmail(email) : "");
  const sortedItems = [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const handleItemClick = (item: NotificationItem) => {
    // settings는 제외, 나머지는 즉시 읽음 처리
    if (item.type !== "settings" && !item.is_read) {
      setOptimisticReadIds((prev) => new Set(prev).add(item.id));
      onMarkRead(item.id);
      const isPersistable = !item.id.startsWith("consulting-");
      if (isPersistable) {
        fetch(`/api/account/notifications/${item.id}`, { method: "PATCH" })
          .then((res) => {
            if (!res.ok) throw new Error("mark-read failed");
          })
          .catch(() => {
            setOptimisticReadIds((prev) => {
              const next = new Set(prev);
              next.delete(item.id);
              return next;
            });
            onRollbackRead(item.id);
            window.dispatchEvent(new CustomEvent("notification-refresh"));
          });
      }
    }
    onClose();
  };

  return createPortal((
    <>
      {/* 백드롭 */}
      <div
        className={`notif-backdrop ${isOpen ? "is-open" : "is-closing"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 드로어 */}
      <div
        ref={drawerRef}
        className={`notif-drawer ${isOpen ? "is-open" : "is-closing"}`}
        role="dialog"
        aria-modal="true"
        aria-label="알림"
      >
        {/* 헤더 */}
        <div className="notif-header">
          <button
            className="notif-back-btn"
            onClick={onClose}
            aria-label="닫기"
            type="button"
          >
            {/* 뒤로가기 화살표 */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="notif-header-username">{headerDisplayName}</span>
          <Link
            href="/account/general"
            className="notif-settings-btn"
            onClick={onClose}
            aria-label="설정"
          >
            {/* 설정 아이콘 */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        </div>

        {/* 알림 목록 */}
        {isLoading && items.length === 0 ? (
          <div className="notif-empty">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="notif-empty">알림이 없습니다.</div>
        ) : (
          <div className="notif-list">
            {(expanded ? sortedItems : sortedItems.slice(0, 5)).map((item, idx) => {
              const isRead = item.is_read || optimisticReadIds.has(item.id);
              const senderName = getSenderName(item.title);
              const senderInitial = senderName ? senderName.slice(0, 1).toUpperCase() : "?";
              const shouldAppendTimestamp =
                item.link.includes("commentId") &&
                (item.type === "gallery_like" ||
                  item.type === "gallery_reply" ||
                  item.type === "gallery_comment_deleted");
              let href = item.link;
              if (href.startsWith("/user_content/")) {
                if (!hasQueryParam(href, "commentId")) {
                  const commentId = getCommentIdFromSourceId(item);
                  if (commentId) href = appendQueryParam(href, "commentId", commentId);
                }
                href = appendQueryParam(href, "from", "notification");
              }
              if (shouldAppendTimestamp) {
                href = appendQueryParam(href, "t", String(Date.now()));
              }
              return (
              <div key={item.id}>
              {expanded && idx === 5 && (
                <button
                  className="notif-more-btn"
                  onClick={() => setExpanded(false)}
                  type="button"
                >
                  접기
                </button>
              )}
              <Link
                key={item.id}
                href={href}
                className={`notif-item ${!isRead ? "is-unread" : ""}`}
                onClick={() => handleItemClick(item)}
              >
                {item.sender_icon ? (
                  <img src={item.sender_icon} className="notif-sender-avatar" alt="" />
                ) : (
                  <span className="notif-sender-avatar notif-sender-avatar-default">
                    <span className="notif-sender-initial">{senderInitial}</span>
                  </span>
                )}
                <div className="notif-item-body">
                  <p className="notif-item-title">
                    {item.type === "settings" ? item.title : formatTitle(item.title)}
                  </p>
                  {item.type !== "settings" && (
                    <p className="notif-item-time">
                      {formatRelativeTime(item.created_at)}
                    </p>
                  )}
                </div>
                {item.related_image ? (
                  <img src={item.related_image} className="notif-related-thumb" alt="" loading="lazy" />
                ) : (
                  <span
                    className={`notif-related-thumb notif-related-thumb-empty${
                      item.type === "settings" ? " is-settings" : ""
                    }`}
                    aria-hidden="true"
                  >
                    {item.type === "settings" ? "A" : (TYPE_ICON[item.type] || "🔔")}
                  </span>
                )}
              </Link>
              </div>
              );
            })}
            {!expanded && sortedItems.length > 5 && (
              <button
                className="notif-more-btn"
                onClick={() => setExpanded(true)}
                type="button"
              >
                {`더보기 (${sortedItems.length - 5}개)`}
              </button>
            )}
          </div>
        )}

        {/* 푸터 */}
        <div className="notif-footer">
          <span className="notif-report-link">
            &lt; 이용관련 불편신고 &gt;
          </span>
        </div>
      </div>
    </>
  ), portalTarget);
}
