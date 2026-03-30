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
};

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
}: NotificationDrawerProps) {
  const [optimisticReadIds, setOptimisticReadIds] = useState<Set<string>>(new Set());
  const drawerRef = useRef<HTMLDivElement>(null);

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
            {/* 홈 아이콘 */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
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
            {items.map((item) => {
              const isRead = item.is_read || optimisticReadIds.has(item.id);
              return (
              <Link
                key={item.id}
                href={item.link}
                className={`notif-item ${!isRead ? "is-unread" : ""}`}
                onClick={() => handleItemClick(item)}
              >
                <div className={`notif-item-icon notif-icon-${item.type}`}>
                  {TYPE_ICON[item.type] || "🔔"}
                </div>
                <div className="notif-item-body">
                  <p className="notif-item-title">{item.title}</p>
                  <p className="notif-item-time">
                    {formatRelativeTime(item.created_at)}
                  </p>
                </div>
              </Link>
              );
            })}
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
