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
  useNotificationCount(isSignedIn ?? false);
  useAdminPendingCount(isSignedIn ?? false);

  // 드로어 상태
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [iconImage, setIconImage] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 배지 카운트: localStorage 초기값으로 즉시 표시 (Clerk 인증 대기 없음)
  const [badgeCount, setBadgeCount] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return Number(localStorage.getItem("header-badge-count") ?? 0);
    }
    return 0;
  });

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
    setIsLoadingNotifications(true);
    try {
      const response = await fetch("/api/account/notifications");
      if (response.ok) {
        const data = (await response.json()) as {
          unreadCount: number;
          items: NotificationItem[];
          iconImage?: string | null;
          username?: string | null;
          email?: string | null;
          notificationEnabled?: boolean;
        };
        setItems(data.items);
        const unread = data.items.filter((item) => !item.is_read).length;
        setBadgeCount(unread);
        localStorage.setItem("header-badge-count", String(unread));
        if (data.username) setUsername(data.username);
        if (data.email) setEmail(data.email);
        setNotificationEnabled(data.notificationEnabled ?? true);

        // 새 갤러리 알림의 댓글 미리 캐시
        const unreadGallery = (data.items as NotificationItem[]).filter(
          (item) =>
            !item.is_read &&
            (item.type === "gallery_like" ||
              item.type === "gallery_reply" ||
              item.type === "gallery_comment_deleted")
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

  function prefetchGalleryFirst() {
    // 첫 번째 카드(people/0) 공개 데이터 prefetch (로그인 무관)
    const publicKey = "gallery_public_people_0";
    const commentsKey = "gallery_comments_people_0";
    if (!getCached(publicKey)) {
      fetch("/api/gallery/people/0/likes")
        .then((r) => r.json())
        .then((d: { count?: number; firstLiker?: string | null; commentCount?: number }) => {
          setCached(publicKey, { count: d.count ?? 0, firstLiker: d.firstLiker ?? null, commentCount: d.commentCount ?? 0 });
          if (!getCached(commentsKey)) {
            fetch("/api/gallery/people/0/comments")
              .then((r) => r.json())
              .then((d2) => setCached(commentsKey, d2))
              .catch(() => {});
          }
        })
        .catch(() => {});
    }
  }

  function prefetchUserReviewList() {
    const cacheKey = "user-review-list-cache";
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { ts } = JSON.parse(cached) as { ts: number };
        if (Date.now() - ts < 60000) return; // 1분 이내 유효
      }
    } catch {}
    fetch("/api/main/user-review?page=1&limit=20&sort=latest")
      .then((r) => r.json())
      .then((data: { items: Array<{ thumbnailImage?: string | null; thumbnailFirst?: string | null; [key: string]: unknown }>; [key: string]: unknown }) => {
        const slim = {
          ...data,
          items: Array.isArray(data.items)
            ? data.items.map((item) => {
                let firstImage: string | null = null;
                if (item.thumbnailImage) {
                  try {
                    const parsed = JSON.parse(item.thumbnailImage);
                    firstImage = Array.isArray(parsed) ? (parsed[0] ?? null) : item.thumbnailImage;
                  } catch {
                    firstImage = item.thumbnailImage;
                  }
                }
                return { ...item, thumbnailImage: firstImage, thumbnailFirst: item.thumbnailFirst ?? null };
              })
            : [],
        };
        sessionStorage.setItem(cacheKey, JSON.stringify({ data: slim, ts: Date.now() }));
      })
      .catch(() => {});
  }

  // 마운트 시 localStorage 캐시에서 즉시 복원 + 갤러리/커뮤니티 동시 prefetch (로그인 무관)
  useEffect(() => {
    const cached = localStorage.getItem("header-avatar");
    if (cached) setIconImage(cached);
    prefetchGalleryFirst();
    prefetchUserReviewList();
  }, []);

  // 초기 로드: 아바타 먼저 → 알림 / 로그아웃 시 캐시 제거
  useEffect(() => {
    if (isSignedIn) {
      void fetchAvatar();
      void fetchNotificationItems();
    } else if (isSignedIn === false) {
      setIconImage(null);
      setBadgeCount(0);
      localStorage.removeItem("header-avatar");
      localStorage.removeItem("header-badge-count");
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

  // general 페이지 알림 토글 상태 즉시 반영
  useEffect(() => {
    function handleNotificationSettingUpdated(e: Event) {
      const detail = (e as CustomEvent<{ enabled: boolean }>).detail;
      if (typeof detail?.enabled === "boolean") {
        setNotificationEnabled(detail.enabled);
        if (detail.enabled) {
          // 켜면 현재 badgeCount를 localStorage에 반영
          setBadgeCount((prev) => {
            localStorage.setItem("header-badge-count", String(prev));
            return prev;
          });
        } else {
          // 끄면 배지 0으로 즉시 반영
          setBadgeCount(0);
          localStorage.setItem("header-badge-count", "0");
        }
      }
    }
    window.addEventListener("notification-setting-updated", handleNotificationSettingUpdated);
    return () => window.removeEventListener("notification-setting-updated", handleNotificationSettingUpdated);
  }, []);

  // 드로어 오픈
  function openDrawer() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    setDrawerMounted(true);
    setDrawerOpen(true);
    void fetchNotificationItems();
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
        {isSignedIn && notificationEnabled && badgeCount > 0 && (
          <span className="header-profile-badge">{badgeCount}</span>
        )}
      </button>

      {/* 알림 드로어 */}
      {drawerMounted && (
        <NotificationDrawer
          isOpen={drawerOpen}
          isMounted={drawerMounted}
          items={items}
          isLoading={isLoadingNotifications}
          username={username}
          email={email}
          onClose={closeDrawer}
          onMarkRead={(id) => setItems((prev) => {
            const next = prev.map((item) => item.id === id ? { ...item, is_read: true } : item);
            const unread = next.filter((item) => !item.is_read).length;
            setBadgeCount(unread);
            localStorage.setItem("header-badge-count", String(unread));
            return next;
          })}
        />
      )}
    </>
  );
}
