"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function useNotificationCount(userId: string | null | undefined) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const normalizedUserId = typeof userId === "string" && userId.length > 0 ? userId : null;
    if (!normalizedUserId) {
      setUnreadCount(0);
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

    // 탭 포커스 시 재조회 (안전망)
    const handleVisibilityChange = () => {
      if (!document.hidden) void fetchUnreadCount();
    };

    // 알림 카운트 강제 갱신 (이벤트 기반)
    const handleRefreshNotification = () => void fetchUnreadCount();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("notification-refresh", handleRefreshNotification);

    // Supabase Realtime 구독 (notifications + inquiries 테이블)
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`notification-count:${normalizedUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        void fetchUnreadCount();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "inquiries" }, () => {
        void fetchUnreadCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("notification-refresh", handleRefreshNotification);
    };
  }, [userId]);

  return unreadCount;
}
