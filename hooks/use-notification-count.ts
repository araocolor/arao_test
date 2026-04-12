"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useHeaderSessionStore } from "@/stores/header-session-store";

export function useNotificationCount(userId: string | null | undefined) {
  const badgeCount = useHeaderSessionStore((state) => state.badgeCount);
  const setBadgeCount = useHeaderSessionStore((state) => state.setBadgeCount);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const normalizedUserId = typeof userId === "string" && userId.length > 0 ? userId : null;
    if (!normalizedUserId) {
      setReady(false);
      return;
    }

    let isActive = true;
    setReady(true);

    async function fetchUnreadCount() {
      try {
        const response = await fetch("/api/account/notifications");
        if (response.ok) {
          const data = (await response.json()) as { unreadCount: number };
          if (isActive) {
            setBadgeCount(data.unreadCount);
          }
        }
      } catch (error) {
        console.error("Failed to fetch unread count:", error);
      }
    }

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
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`notification-count:${normalizedUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => { void fetchUnreadCount(); }, 1000);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "inquiries" }, () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => { void fetchUnreadCount(); }, 1000);
      })
      .subscribe();

    return () => {
      isActive = false;
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("notification-refresh", handleRefreshNotification);
    };
  }, [userId]);

  return { unreadCount: badgeCount, ready };
}
