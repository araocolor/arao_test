"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useNotificationCount } from "@/hooks/use-notification-count";
import { useAdminPendingCount } from "@/hooks/use-admin-pending-count";
import { NotificationDrawer } from "@/components/notification-drawer";
import type { NotificationItem } from "@/lib/notifications";
import { getCached, setCached } from "@/hooks/use-prefetch-cache";

export function HeaderProfileLink() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const unreadCount = useNotificationCount(isSignedIn ?? false);
  const pendingCount = useAdminPendingCount(isSignedIn ?? false);

  // 드로어 상태
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [iconImage, setIconImage] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 배지 카운트: items 중 is_read = false인 개수
  const badgeCount = items.filter((item) => !item.is_read).length;

  // 아바타만 먼저 조회 (빠른 업데이트)
  async function fetchAvatar() {
    try {
      const response = await fetch("/api/account/avatar");
      if (response.ok) {
        const data = (await response.json()) as { iconImage?: string | null };
        const img = data.iconImage ?? null;
        setIconImage(img);
        if (img) {
          localStorage.setItem("header-avatar", img);
        } else {
          localStorage.removeItem("header-avatar");
        }
      }
    } catch (error) {
      console.error("Failed to fetch avatar:", error);
    }
  }

  // 알림 목록 조회 (백그라운드)
  async function fetchNotificationItems() {
    try {
      const response = await fetch("/api/account/notifications");
      if (response.ok) {
        const data = (await response.json()) as {
          unreadCount: number;
          items: NotificationItem[];
          iconImage?: string | null;
          username?: string | null;
          email?: string | null;
        };
        setItems(data.items);
        if (data.username) setUsername(data.username);
        if (data.email) setEmail(data.email);

        // 새 알림(gallery_like)의 댓글 미리 캐시
        const unreadGallery = (data.items as NotificationItem[]).filter(
          (item) => item.type === "gallery_like" && !item.is_read
        );
        for (const item of unreadGallery) {
          try {
            const url = new URL(item.link, window.location.origin);
            const category = url.searchParams.get("category");
            const index = url.searchParams.get("index");
            if (!category || !index) continue;
            const commentKey = `gallery_comments_${category}_${index}`;
            if (!getCached(commentKey)) {
              fetch(`/api/gallery/${category}/${index}/comments`)
                .then((r) => r.json())
                .then((d) => setCached(commentKey, d))
                .catch(() => {});
            }
          } catch {
            // URL 파싱 실패 시 무시
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setIsLoadingNotifications(false);
    }
  }

  // 마운트 시 localStorage 캐시에서 즉시 복원
  useEffect(() => {
    const cached = localStorage.getItem("header-avatar");
    if (cached) setIconImage(cached);
  }, []);

  // 초기 로드: 아바타 먼저 → 알림은 백그라운드 / 로그아웃 시 캐시 제거
  useEffect(() => {
    if (isSignedIn) {
      void fetchAvatar();
      void fetchNotificationItems();
    } else if (isSignedIn === false) {
      setIconImage(null);
      localStorage.removeItem("header-avatar");
    }
  }, [isSignedIn]);

  // 아바타 업데이트 이벤트 수신
  useEffect(() => {
    function handleAvatarUpdated(e: Event) {
      const detail = (e as CustomEvent<{ iconImage: string }>).detail;
      setIconImage(detail.iconImage);
      localStorage.setItem("header-avatar", detail.iconImage);
    }
    window.addEventListener("avatar-updated", handleAvatarUpdated);
    return () => window.removeEventListener("avatar-updated", handleAvatarUpdated);
  }, []);

  // 드로어 오픈
  function openDrawer() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    setDrawerMounted(true);
    setDrawerOpen(true);
  }

  // 드로어 닫기
  function closeDrawer() {
    setDrawerOpen(false);
    const isTablet = window.innerWidth >= 481;
    closeTimerRef.current = setTimeout(() => {
      setDrawerMounted(false);
    }, isTablet ? 300 : 1000);
  }

  // 정리
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  // 클릭 핸들러
  function handleClick() {
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    openDrawer();
  }

  return (
    <>
      <button
        className={`header-profile-link ${isSignedIn ? "signed-in" : ""}`}
        onClick={handleClick}
        aria-label="알림"
        type="button"
      >
        {iconImage ? (
          <img src={iconImage} className="header-profile-avatar" alt="avatar" aria-hidden="true" />
        ) : (
          <span className="header-profile-icon" aria-hidden="true">
            <span className="header-profile-head" />
            <span className="header-profile-body" />
          </span>
        )}
        {isSignedIn && badgeCount > 0 && (
          <span className="header-profile-badge">{badgeCount}</span>
        )}
      </button>

      {/* 알림 드로어 */}
      {drawerMounted && (
        <NotificationDrawer
          isOpen={drawerOpen}
          isMounted={drawerMounted}
          items={items}
          username={username}
          email={email}
          onClose={closeDrawer}
          onMarkRead={(id) => setItems((prev) => prev.map((item) => item.id === id ? { ...item, is_read: true } : item))}
        />
      )}
    </>
  );
}
