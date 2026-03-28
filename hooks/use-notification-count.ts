"use client";

import { useEffect, useState } from "react";

export function useNotificationCount(isSignedIn: boolean) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }

    async function fetchUnreadCount() {
      try {
        const response = await fetch("/api/account/notifications");
        if (response.ok) {
          const data = (await response.json()) as { unreadCount: number };
          setUnreadCount(data.unreadCount);
        }
      } catch (error) {
        console.error("Failed to fetch unread count:", error);
      }
    }

    // 초기 로드
    void fetchUnreadCount();

    // 60초마다 polling
    const pollInterval = setInterval(fetchUnreadCount, 60_000);

    // 탭 포커스 시 즉시 재조회
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void fetchUnreadCount();
      }
    };

    // 알림 카운트 강제 갱신 (이벤트 기반)
    const handleRefreshNotification = () => {
      void fetchUnreadCount();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("notification-refresh", handleRefreshNotification);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("notification-refresh", handleRefreshNotification);
    };
  }, [isSignedIn]);

  return unreadCount;
}
