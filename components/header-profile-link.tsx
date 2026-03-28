"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useNotificationCount } from "@/hooks/use-notification-count";
import { useAdminPendingCount } from "@/hooks/use-admin-pending-count";
import { NotificationDrawer } from "@/components/notification-drawer";
import type { NotificationItem } from "@/lib/notifications";

export function HeaderProfileLink() {
  const { isSignedIn, user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null;
  const router = useRouter();
  const unreadCount = useNotificationCount(isSignedIn ?? false);
  const pendingCount = useAdminPendingCount(isSignedIn ?? false);

  // 드로어 상태
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [iconImage, setIconImage] = useState<string | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 배지 카운트: items 중 is_read = false인 개수
  const badgeCount = items.filter((item) => !item.is_read).length;

  // 알림 목록 조회
  async function fetchNotificationItems() {
    try {
      const response = await fetch("/api/account/notifications");
      if (response.ok) {
        const data = (await response.json()) as {
          unreadCount: number;
          items: NotificationItem[];
          iconImage?: string | null;
        };
        setItems(data.items);
        const img = data.iconImage ?? null;
        setIconImage(img);
        if (img) {
          localStorage.setItem("header-avatar", img);
        } else {
          localStorage.removeItem("header-avatar");
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

  // 초기 로드: 마운트 시 알림 항목 미리 조회 / 로그아웃 시 캐시 제거
  useEffect(() => {
    if (isSignedIn) {
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
    closeTimerRef.current = setTimeout(() => {
      setDrawerMounted(false);
    }, 180); // CSS transition duration과 동일
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
        onMouseEnter={() => {
          if (!isSignedIn || !email) return;
          setTooltipVisible(true);
          tooltipTimerRef.current = setTimeout(() => setTooltipVisible(false), 1000);
        }}
        onMouseLeave={() => {
          if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
          setTooltipVisible(false);
        }}
      >
        {isSignedIn && email && tooltipVisible && (
          <span className="header-profile-email-tooltip">{email}</span>
        )}
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
          onClose={closeDrawer}
        />
      )}
    </>
  );
}
