"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { type NotificationItem } from "@/lib/notifications";

type NotificationDrawerProps = {
  isOpen: boolean;
  isMounted: boolean;
  items: NotificationItem[];
  username: string | null;
  email: string | null;
  onClose: () => void;
  onMarkRead: (id: string) => void;
};

// 알림 제목에서 "{이름}님이" 앞부분을 bold 처리
function formatTitle(title: string): React.ReactNode {
  const t = title.endsWith(".") ? title : title + ".";
  const idx = t.indexOf("님이");
  if (idx <= 0) return t;
  const name = t.slice(0, idx);
  const rest = t.slice(idx);
  return <><strong>{name}</strong>{rest}</>;
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
  gallery_like: "갤러리",
};

// 알림 타입별 아이콘 이모지
const TYPE_ICON: Record<string, string> = {
  settings: "⚙️",
  order_shipped: "📦",
  order_cancelled: "⚠️",
  consulting: "💬",
  review_reply: "📝",
  gallery_like: "❤️",
};

export function NotificationDrawer({
  isOpen,
  isMounted,
  items,
  username,
  email,
  onClose,
  onMarkRead,
}: NotificationDrawerProps) {
  const [optimisticReadIds, setOptimisticReadIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

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

  if (!isMounted) return null;

  const handleItemClick = (item: NotificationItem) => {
    // settings/consulting 제외, 나머지는 즉시 읽음 처리
    if (item.type !== "settings" && item.type !== "consulting" && !item.is_read) {
      setOptimisticReadIds((prev) => new Set(prev).add(item.id));
      onMarkRead(item.id);
      fetch(`/api/account/notifications/${item.id}`, { method: "PATCH" }).catch(() => {});
    }
    onClose();
  };

  return (
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
          <span className="notif-header-username">{username || email || ""}</span>
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
        {items.length === 0 ? (
          <div className="notif-empty">알림이 없습니다.</div>
        ) : (
          <div className="notif-list">
            {(expanded ? items : items.slice(0, 5)).map((item) => {
              const isRead = item.is_read || optimisticReadIds.has(item.id);
              return (
              <Link
                key={item.id}
                href={item.type === "gallery_like" && item.link.includes("commentId") ? `${item.link}&t=${Date.now()}` : item.link}
                className={`notif-item ${!isRead ? "is-unread" : ""}`}
                onClick={() => handleItemClick(item)}
              >
                <div className={`notif-item-icon notif-icon-${item.type}`}>
                  {TYPE_ICON[item.type] || "🔔"}
                </div>
                <div className="notif-item-body">
                  <p className="notif-item-title">{formatTitle(item.title)}</p>
                  <p className="notif-item-time">
                    {formatRelativeTime(item.created_at)}
                  </p>
                </div>
                {item.sender_icon ? (
                  <img src={item.sender_icon} className="notif-sender-avatar" alt="" />
                ) : (
                  <span className="notif-sender-avatar notif-sender-avatar-default">
                    <span className="notif-sender-head" />
                    <span className="notif-sender-body" />
                  </span>
                )}
              </Link>
              );
            })}
            {!expanded && items.length > 5 && (
              <button
                className="notif-more-btn"
                onClick={() => setExpanded(true)}
                type="button"
              >
                더보기 ({items.length - 5}개)
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
  );
}
