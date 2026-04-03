"use client";

import { useRef, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useNotificationCount } from "@/hooks/use-notification-count";
import { useAdminPendingCount } from "@/hooks/use-admin-pending-count";
import { NotificationDrawer } from "@/components/notification-drawer";
import type { NotificationItem } from "@/lib/notifications";
import { getCached, setCached } from "@/hooks/use-prefetch-cache";

const REVIEW_LIST_CACHE_TTL = 300000; // 5분
const REVIEW_PREFETCH_LOCK_KEY = "user-review-list-prefetch-lock";
const REVIEW_PREFETCH_LOCK_MS = 10000;
const NOTIFICATION_CACHE_PREFIX = "header-notifications-cache-v1";
const NOTIFICATION_CACHE_TTL = 60000; // 60초

type NotificationPayload = {
  unreadCount: number;
  items: NotificationItem[];
  iconImage?: string | null;
  username?: string | null;
  email?: string | null;
  notificationEnabled?: boolean;
};

type NotificationCacheSnapshot = {
  data: NotificationPayload;
  ts: number;
};

function getNotificationCacheKey(userId: string | null | undefined): string {
  return `${NOTIFICATION_CACHE_PREFIX}:${userId ?? "anon"}`;
}

function readNotificationCache(cacheKey: string): NotificationPayload | null {
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NotificationCacheSnapshot;
    if (!parsed?.data || !Number.isFinite(parsed.ts)) return null;
    if (Date.now() - parsed.ts > NOTIFICATION_CACHE_TTL) {
      sessionStorage.removeItem(cacheKey);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeNotificationCache(cacheKey: string, payload: NotificationPayload): void {
  try {
    const snapshot: NotificationCacheSnapshot = { data: payload, ts: Date.now() };
    sessionStorage.setItem(cacheKey, JSON.stringify(snapshot));
  } catch {}
}

function clearNotificationCacheAll(): void {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i);
      if (!key || !key.startsWith(NOTIFICATION_CACHE_PREFIX)) continue;
      sessionStorage.removeItem(key);
    }
  } catch {}
}

function canPrefetchReviewList(): boolean {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return false;
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (!connection) return true;
  if (connection.saveData) return false;
  if (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g") return false;
  return true;
}

function isReviewListCacheFresh(cacheKey: string): boolean {
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (!raw) return false;
    const { ts } = JSON.parse(raw) as { ts: number };
    return Date.now() - ts < REVIEW_LIST_CACHE_TTL;
  } catch {
    return false;
  }
}

function isReviewPrefetchLocked(): boolean {
  try {
    const raw = sessionStorage.getItem(REVIEW_PREFETCH_LOCK_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < REVIEW_PREFETCH_LOCK_MS;
  } catch {
    return false;
  }
}

export function HeaderProfileLink() {
  const { isSignedIn, user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const realtimeUnreadCount = useNotificationCount(isSignedIn ?? false);
  useAdminPendingCount(isSignedIn ?? false);
  const notificationCacheKey = getNotificationCacheKey(user?.id);

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
  const [mounted, setMounted] = useState(false);

  // 배지 카운트: localStorage 초기값으로 즉시 표시 (Clerk 인증 대기 없음)
  const [badgeCount, setBadgeCount] = useState<number>(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  function applyNotificationPayload(payload: NotificationPayload, options?: { persist?: boolean }) {
    const nextItems = Array.isArray(payload.items) ? payload.items : [];
    const unread = Number.isFinite(payload.unreadCount)
      ? payload.unreadCount
      : nextItems.filter((item) => !item.is_read).length;
    setItems(nextItems);
    setBadgeCount(unread);
    localStorage.setItem("header-badge-count", String(unread));
    if (payload.iconImage !== undefined) {
      const img = payload.iconImage ?? null;
      setIconImage(img);
      if (img) localStorage.setItem("header-avatar", img);
      else localStorage.removeItem("header-avatar");
    }
    if (payload.username !== undefined) setUsername(payload.username ?? null);
    if (payload.email !== undefined) setEmail(payload.email ?? null);
    setNotificationEnabled(payload.notificationEnabled ?? true);
    if (options?.persist !== false) {
      writeNotificationCache(notificationCacheKey, {
        unreadCount: unread,
        items: nextItems,
        iconImage: payload.iconImage,
        username: payload.username,
        email: payload.email,
        notificationEnabled: payload.notificationEnabled,
      });
    }
  }

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
  async function fetchNotificationItems(options?: { showLoading?: boolean }) {
    const showLoading = options?.showLoading ?? items.length === 0;
    if (showLoading) setIsLoadingNotifications(true);
    try {
      const response = await fetch("/api/account/notifications");
      if (response.ok) {
        const data = (await response.json()) as NotificationPayload;
        applyNotificationPayload(data);

        // 새 갤러리 알림의 댓글 미리 캐시
        const unreadGallery = (data.items ?? []).filter(
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
    if (getCached(publicKey)) return;
    fetch("/api/gallery/people/0/likes")
      .then((r) => r.json())
      .then((d: { count?: number; firstLiker?: string | null; commentCount?: number }) => {
        setCached(publicKey, { count: d.count ?? 0, firstLiker: d.firstLiker ?? null, commentCount: d.commentCount ?? 0 });
        fetch("/api/gallery/people/0/comments")
          .then((r) => r.json())
          .then((d2) => setCached(commentsKey, d2))
          .catch(() => {});
      })
      .catch(() => {});
  }

  function prefetchUserReviewList() {
    const cacheKey = "user-review-list-cache";
    if (!canPrefetchReviewList()) return;
    if (isReviewListCacheFresh(cacheKey)) return;
    if (isReviewPrefetchLocked()) return;
    sessionStorage.setItem(REVIEW_PREFETCH_LOCK_KEY, String(Date.now()));

    fetch("/api/main/user-review?page=1&limit=20&sort=latest")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { items: Array<{ thumbnailImage?: string | null; thumbnailFirst?: string | null; [key: string]: unknown }>; [key: string]: unknown }) => {
        if (!data) return;
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
      .catch(() => {})
      .finally(() => {
        sessionStorage.removeItem(REVIEW_PREFETCH_LOCK_KEY);
      });
  }

  // 마운트 시 localStorage 캐시에서 즉시 복원 + 갤러리/커뮤니티 동시 prefetch (로그인 무관)
  useEffect(() => {
    const cached = localStorage.getItem("header-avatar");
    if (cached) setIconImage(cached);
    const savedBadge = Number(localStorage.getItem("header-badge-count") ?? 0);
    if (savedBadge > 0) setBadgeCount(savedBadge);
    prefetchGalleryFirst();
    prefetchUserReviewList();
  }, []);

  // 로그인 사용자별 알림 캐시 즉시 복원 (첫 클릭 체감 개선)
  useEffect(() => {
    if (!isSignedIn) return;
    const cached = readNotificationCache(notificationCacheKey);
    if (!cached) return;
    applyNotificationPayload(cached, { persist: false });
  }, [isSignedIn, notificationCacheKey]);

  // 사이트 체류 중 2분마다 리스트/갤러리 캐시 백그라운드 갱신 (탭 visible일 때만)
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        prefetchUserReviewList();
      }
    }, 120000);
    return () => clearInterval(timer);
  }, []);

  // 실시간 unread 카운트를 헤더 뱃지에 동기화
  useEffect(() => {
    if (!isSignedIn || !notificationEnabled) return;
    if (drawerOpen) return;
    setBadgeCount((prev) => {
      if (prev === realtimeUnreadCount) return prev;
      localStorage.setItem("header-badge-count", String(realtimeUnreadCount));
      return realtimeUnreadCount;
    });
  }, [isSignedIn, notificationEnabled, realtimeUnreadCount, drawerOpen]);

  // 초기 로드: 아바타 먼저 → 알림 / 로그아웃 시 캐시 제거
  useEffect(() => {
    if (isSignedIn) {
      void fetchAvatar();
      void fetchNotificationItems({ showLoading: false });
    } else if (isSignedIn === false) {
      setIconImage(null);
      setBadgeCount(0);
      setItems([]);
      setUsername(null);
      setEmail(null);
      localStorage.removeItem("header-avatar");
      localStorage.removeItem("header-badge-count");
      clearNotificationCacheAll();
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

    const cached = readNotificationCache(notificationCacheKey);
    if (cached) {
      applyNotificationPayload(cached, { persist: false });
    }
    setDrawerMounted(true);
    setDrawerOpen(true);
    void fetchNotificationItems({ showLoading: !cached });
  }

  // 드로어 닫기
  function closeDrawer() {
    setDrawerOpen(false);
    closeTimerRef.current = setTimeout(() => {
      setDrawerMounted(false);
    }, 260);
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

  function handleCommunitySearchOpen() {
    window.dispatchEvent(new CustomEvent("community-search-open"));
  }

  const isCommunityListPage = mounted && pathname === "/user_review";

  return (
    <>
      <div className="header-profile-actions">
        {isCommunityListPage && (
          <button
            className="header-community-search-trigger"
            type="button"
            aria-label="커뮤니티 검색 열기"
            onClick={handleCommunitySearchOpen}
          >
            <svg className="header-community-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="16.65" y1="16.65" x2="21" y2="21" />
            </svg>
          </button>
        )}
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
      </div>

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
            writeNotificationCache(notificationCacheKey, {
              unreadCount: unread,
              items: next,
              iconImage,
              username,
              email,
              notificationEnabled,
            });
            return next;
          })}
          onRollbackRead={(id) => setItems((prev) => {
            const next = prev.map((item) => item.id === id ? { ...item, is_read: false } : item);
            const unread = next.filter((item) => !item.is_read).length;
            setBadgeCount(unread);
            localStorage.setItem("header-badge-count", String(unread));
            writeNotificationCache(notificationCacheKey, {
              unreadCount: unread,
              items: next,
              iconImage,
              username,
              email,
              notificationEnabled,
            });
            return next;
          })}
        />
      )}
    </>
  );
}
