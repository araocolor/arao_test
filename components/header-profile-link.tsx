"use client";

import { useRef, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Heart, UserRound } from "lucide-react";
import { useAdminPendingCount } from "@/hooks/use-admin-pending-count";
import { NotificationDrawer } from "@/components/notification-drawer";
import type { NotificationItem } from "@/lib/notifications";
import { getCached, setCached } from "@/hooks/use-prefetch-cache";
import { useHeaderSessionStore } from "@/stores/header-session-store";
import { REVIEW_LIST_CACHE_TTL, NOTIFICATION_CACHE_TTL } from "@/lib/cache-config";
import { GALLERY_CATEGORIES } from "@/lib/gallery-categories";

const REVIEW_PREFETCH_LOCK_KEY = "user-review-list-prefetch-lock";
const REVIEW_PREFETCH_LOCK_MS = 10000;
const NOTIFICATION_CACHE_PREFIX = "header-notifications-cache-v1";
const NOTIFICATION_REOPEN_ONCE_KEY = "header-notification-reopen-once";
const COMMENT_PREFETCH_CATEGORIES = ["people", "outdoor", "indoor", "cafe"] as const;

type NotificationPayload = {
  unreadCount: number;
  items: NotificationItem[];
  iconImage?: string | null;
  username?: string | null;
  email?: string | null;
  notificationEnabled?: boolean;
  role?: string | null;
};

type NotificationCacheSnapshot = {
  data: NotificationPayload;
  ts: number;
};

function slimGalleryCommentsForCache(input: unknown): { comments: unknown[] } {
  const sourceComments = Array.isArray(input)
    ? input
    : input && typeof input === "object" && Array.isArray((input as { comments?: unknown[] }).comments)
      ? (input as { comments: unknown[] }).comments
      : [];
  return { comments: sourceComments };
}

function getNotificationCacheKey(userId: string | null | undefined): string {
  return `${NOTIFICATION_CACHE_PREFIX}:${userId ?? "anon"}`;
}

function readNotificationCache(cacheKey: string): NotificationPayload | null {
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NotificationCacheSnapshot;
    if (!parsed?.data || !Number.isFinite(parsed.ts)) return null;
    // 캐시 만료되었더라도 즉시 표시, 백그라운드 fetch가 갱신
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
  useAdminPendingCount(isSignedIn ?? false);
  const notificationCacheKey = getNotificationCacheKey(user?.id);
  const badgeCount = useHeaderSessionStore((state) => state.badgeCount);
  const iconImage = useHeaderSessionStore((state) => state.avatar);
  const hydrateHeaderSession = useHeaderSessionStore((state) => state.hydrateForUser);
  const setHeaderBadgeCount = useHeaderSessionStore((state) => state.setBadgeCount);
  const setHeaderAvatar = useHeaderSessionStore((state) => state.setAvatar);
  const setHeaderUsername = useHeaderSessionStore((state) => state.setUsername);
  const setHeaderEmail = useHeaderSessionStore((state) => state.setEmail);
  const setHeaderRole = useHeaderSessionStore((state) => state.setRole);
  const setHeaderTier = useHeaderSessionStore((state) => state.setTier);
  const clearActiveHeaderSession = useHeaderSessionStore((state) => state.clearActiveUserCache);

  // 드로어 상태
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const itemsRef = useRef<NotificationItem[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawerOpenedRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  function applyNotificationPayload(payload: NotificationPayload, options?: { persist?: boolean }) {
    const nextItems = Array.isArray(payload.items) ? payload.items : [];
    const unread = Number.isFinite(payload.unreadCount)
      ? payload.unreadCount
      : nextItems.filter((item) => !item.is_read).length;
    const nextNotificationEnabled = payload.notificationEnabled ?? true;
    setItems(nextItems);
    setHeaderBadgeCount(unread);
    if (payload.iconImage !== undefined) {
      const img = payload.iconImage ?? null;
      setHeaderAvatar(img);
    }
    if (payload.username !== undefined) {
      const nextUsername = payload.username ?? null;
      setUsername(nextUsername);
      setHeaderUsername(nextUsername);
    }
    if (payload.email !== undefined) {
      setEmail(payload.email ?? null);
      setHeaderEmail(payload.email ?? null);
    }
    if (payload.role !== undefined) setHeaderRole(payload.role ?? null);
    setNotificationEnabled(nextNotificationEnabled);
    if (options?.persist !== false) {
      writeNotificationCache(notificationCacheKey, {
        unreadCount: unread,
        items: nextItems,
        iconImage: payload.iconImage,
        username: payload.username,
        email: payload.email,
        notificationEnabled: nextNotificationEnabled,
      });
    }
  }

  // 아바타/아이디 먼저 조회 (빠른 업데이트)
  async function fetchAvatar() {
    try {
      const response = await fetch("/api/account/avatar");
      if (response.ok) {
        const data = (await response.json()) as {
          iconImage?: string | null;
          username?: string | null;
          tier?: string | null;
          role?: string | null;
        };
        const img = data.iconImage ?? null;
        setHeaderAvatar(img);
        setHeaderUsername(data.username ?? null);
        setHeaderTier(data.tier ?? null);
        if (data.role !== undefined) setHeaderRole(data.role ?? null);
      }
    } catch (error) {
      console.error("Failed to fetch avatar:", error);
    }
  }

  // 알림 목록 조회 — 안 읽은 중요알림 최대 3개 (컨설팅 → 댓글 → 대댓글 순)
  const TYPE_PRIORITY: Record<string, number> = {
    consulting: 0,
    review_comment: 1,
    gallery_reply: 1,
    review_reply: 2,
    gallery_comment_deleted: 2,
  };

  function getTop3UnreadItems(allItems: NotificationItem[]): NotificationItem[] {
    return allItems
      .filter((item) => !item.is_read && item.type !== "settings")
      .sort((a, b) => {
        const pa = TYPE_PRIORITY[a.type] ?? 99;
        const pb = TYPE_PRIORITY[b.type] ?? 99;
        if (pa !== pb) return pa - pb;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
      .slice(0, 3);
  }

  async function fetchNotificationItems(options?: { showLoading?: boolean }) {
    const showLoading = options?.showLoading ?? items.length === 0;
    if (showLoading) setIsLoadingNotifications(true);
    try {
      const response = await fetch("/api/account/notifications");
      if (response.ok) {
        const data = (await response.json()) as NotificationPayload;
        const hasUnread = getTop3UnreadItems(data.items ?? []).length > 0;
        applyNotificationPayload({ ...data, unreadCount: drawerOpenedRef.current ? 0 : (hasUnread ? 1 : 0) });
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setIsLoadingNotifications(false);
    }
  }

  function prefetchGalleryFirst() {
    // 1차: 첫 번째 카드(people/0) 즉시 캐싱
    const publicKey = "gallery_public_people_0";
    const commentsKey = "gallery_comments_people_0";
    if (getCached(publicKey)) {
      // 1차 이미 캐시됨 → 바로 2차 진행
      prefetchGalleryAll();
      return;
    }
    fetch("/api/gallery/people/0/likes")
      .then((r) => r.json())
      .then((d: { count?: number; firstLiker?: string | null; commentCount?: number; beforeImage?: string | null; afterImage?: string | null }) => {
        setCached(publicKey, { count: d.count ?? 0, firstLiker: d.firstLiker ?? null, commentCount: d.commentCount ?? 0 });
        if (d.beforeImage) { const img = new Image(); img.src = d.beforeImage; }
        if (d.afterImage) { const img = new Image(); img.src = d.afterImage; }
        fetch("/api/gallery/people/0/comments")
          .then((r) => r.json())
          .then((d2) => {
            setCached(commentsKey, slimGalleryCommentsForCache(d2));
            // 1차 완료 후 2차: 나머지 전체 묶음 캐싱
            prefetchGalleryAll();
          })
          .catch(() => {});
      })
      .catch(() => {});
  }

  function prefetchGalleryAll() {
    // 2차: 전체 카드 좋아요/댓글 수 묶음 1번 호출
    const cards = GALLERY_CATEGORIES.map((category, index) => ({ category, index }));
    const uncached = cards.filter((c) => !getCached(`gallery_public_${c.category}_${c.index}`));

    const commentTargets = COMMENT_PREFETCH_CATEGORIES
      .map((category) => ({ category, index: GALLERY_CATEGORIES.indexOf(category) }))
      .filter((target) => target.index >= 0);
    const uncachedComments = commentTargets.filter(
      (target) => !getCached(`gallery_comments_${target.category}_${target.index}`)
    );

    if (uncached.length === 0 && uncachedComments.length === 0) return;

    fetch("/api/gallery/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cards: uncached, withComments: uncachedComments }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((res: { results?: Array<{ category: string; index: number; count: number; liked: boolean; firstLiker: string | null; commentCount: number }>; commentsList?: Record<string, unknown[]> } | null) => {
        if (!res) return;
        for (const d of res.results ?? []) {
          setCached(`gallery_public_${d.category}_${d.index}`, {
            count: d.count,
            firstLiker: d.firstLiker,
            commentCount: d.commentCount,
          });
        }
        for (const [targetKey, comments] of Object.entries(res.commentsList ?? {})) {
          const [category, rawIndex] = targetKey.split(":");
          const index = Number(rawIndex);
          if (!category || !Number.isFinite(index)) continue;
          setCached(`gallery_comments_${category}_${index}`, slimGalleryCommentsForCache(comments));
        }
      })
      .catch(() => {});
  }

  function slimItems(items: Array<{ id?: unknown; thumbnailImage?: string | null; thumbnailFirst?: string | null; [key: string]: unknown }>) {
    return items.map((item) => {
      let firstImage: string | null = null;
      if (item.thumbnailImage) {
        try {
          const parsed = JSON.parse(item.thumbnailImage as string);
          firstImage = Array.isArray(parsed) ? (parsed[0] ?? null) : item.thumbnailImage as string;
        } catch {
          firstImage = item.thumbnailImage as string;
        }
      }
      return { ...item, thumbnailImage: firstImage, thumbnailFirst: item.thumbnailFirst ?? null };
    });
  }

  function prefetchBoardInteractions(items: Array<{ id?: unknown }>) {
    const ids = items.map((item) => item.id).filter((id): id is string => typeof id === "string");
    if (ids.length === 0) return;
    fetch("/api/main/user-review/batch-interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((res: { results?: Record<string, { likes: unknown; comments: unknown }> } | null) => {
        if (!res?.results) return;
        const now = Date.now();
        for (const [id, data] of Object.entries(res.results)) {
          sessionStorage.setItem(`user-review-likes-${id}`, JSON.stringify({ data: data.likes, ts: now }));
          sessionStorage.setItem(`user-review-comments-${id}`, JSON.stringify({ data: data.comments, ts: now }));
        }
      })
      .catch(() => {});
  }

  function prefetchBoardList(board: string, cacheKey: string, onDone?: () => void) {
    fetch(`/api/main/user-review?page=1&limit=20&sort=latest&board=${board}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { items?: Array<{ thumbnailImage?: string | null; thumbnailFirst?: string | null; [key: string]: unknown }>; [key: string]: unknown } | null) => {
        if (!data || !Array.isArray(data.items)) return;
        const slim = { ...data, items: slimItems(data.items) };
        sessionStorage.setItem(cacheKey, JSON.stringify({ data: slim, ts: Date.now() }));
        prefetchBoardInteractions(slim.items);
        onDone?.();
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
      .then((data: { items?: Array<{ thumbnailImage?: string | null; thumbnailFirst?: string | null; [key: string]: unknown }>; [key: string]: unknown } | null) => {
        if (!data || !Array.isArray(data.items)) return;
        const slim = { ...data, items: slimItems(data.items) };
        sessionStorage.setItem(cacheKey, JSON.stringify({ data: slim, ts: Date.now() }));
        prefetchBoardInteractions(slim.items);
        // review 캐싱 완료 후 arao 연속 캐싱
        prefetchBoardList("arao", "user-review-list-cache-arao");
      })
      .catch(() => {})
      .finally(() => {
        sessionStorage.removeItem(REVIEW_PREFETCH_LOCK_KEY);
      });
  }

  // 마운트 시 갤러리/커뮤니티 동시 prefetch (로그인 무관)
  useEffect(() => {
    prefetchGalleryFirst();
    prefetchUserReviewList();
  }, []);

  // 로그인 사용자별 헤더 상태(배지/아바타) 즉시 복원
  useEffect(() => {
    if (isSignedIn && user?.id) {
      hydrateHeaderSession(user.id);
      return;
    }
    if (isSignedIn === false) {
      hydrateHeaderSession(null);
    }
  }, [isSignedIn, user?.id, hydrateHeaderSession]);

  // 로그인 사용자별 알림 캐시 즉시 복원 (첫 클릭 체감 개선)
  useEffect(() => {
    if (!isSignedIn) return;
    const cached = readNotificationCache(notificationCacheKey);
    if (!cached) return;
    applyNotificationPayload(cached, { persist: false });
  }, [isSignedIn, notificationCacheKey]);

  // 알림 경유 본문에서 리스트로 복귀했을 때 알림창 자동 재오픈
  useEffect(() => {
    if (!isSignedIn) return;
    if (pathname !== "/user_review") return;
    let shouldReopen = false;
    try {
      shouldReopen = sessionStorage.getItem(NOTIFICATION_REOPEN_ONCE_KEY) === "1";
      if (shouldReopen) sessionStorage.removeItem(NOTIFICATION_REOPEN_ONCE_KEY);
    } catch {}
    if (!shouldReopen) return;
    const cached = readNotificationCache(notificationCacheKey);
    if (cached) {
      applyNotificationPayload(cached, { persist: false });
    }
    setDrawerMounted(true);
    setDrawerOpen(true);
    void fetchNotificationItems({ showLoading: !cached });
  }, [isSignedIn, pathname, notificationCacheKey]);


  // 초기 로드: 아바타 먼저 → 알림 / 로그아웃 시 캐시 제거
  useEffect(() => {
    if (isSignedIn) {
      void fetchAvatar();
      void fetchNotificationItems({ showLoading: false });
    } else if (isSignedIn === false) {
      drawerOpenedRef.current = false;
      clearActiveHeaderSession();
      setItems([]);
      setUsername(null);
      setEmail(null);
      clearNotificationCacheAll();
    }
  }, [isSignedIn, clearActiveHeaderSession]);

  // 아바타 업데이트 이벤트 수신
  useEffect(() => {
    function handleAvatarUpdated(e: Event) {
      const detail = (e as CustomEvent<{ iconImage: string | null }>).detail;
      setHeaderAvatar(detail.iconImage ?? null);
    }
    window.addEventListener("avatar-updated", handleAvatarUpdated);
    return () => window.removeEventListener("avatar-updated", handleAvatarUpdated);
  }, [setHeaderAvatar]);

  // general 페이지 알림 토글 상태 즉시 반영
  useEffect(() => {
    function handleNotificationSettingUpdated(e: Event) {
      const detail = (e as CustomEvent<{ enabled: boolean }>).detail;
      if (typeof detail?.enabled === "boolean") {
        setNotificationEnabled(detail.enabled);
        void fetchNotificationItems({ showLoading: false });
      }
    }
    window.addEventListener("notification-setting-updated", handleNotificationSettingUpdated);
    return () => window.removeEventListener("notification-setting-updated", handleNotificationSettingUpdated);
  }, [notificationCacheKey]);

  // 드로어 오픈
  function openDrawer() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    const cached = readNotificationCache(notificationCacheKey);
    if (cached) {
      applyNotificationPayload({ ...cached, unreadCount: 0 }, { persist: false });
    }
    setDrawerMounted(true);
    setDrawerOpen(true);

    // 드로어 열리는 순간 빨간점 OFF (로그아웃 전까지 유지)
    drawerOpenedRef.current = true;
    setHeaderBadgeCount(0);
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
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
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

  function applyReadStateToNotificationItem(id: string, isRead: boolean) {
    const nextItems = itemsRef.current.map((item) => (item.id === id ? { ...item, is_read: isRead } : item));
    itemsRef.current = nextItems;
    setItems(nextItems);
    writeNotificationCache(notificationCacheKey, {
      unreadCount: 0,
      items: nextItems,
      iconImage,
      username,
      email,
      notificationEnabled,
    });
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
          className="header-notif-btn"
          onClick={handleClick}
          aria-label="알림"
          type="button"
        >
          <Heart width={22} height={22} strokeWidth={1.7} aria-hidden="true" />
          {isSignedIn && notificationEnabled && badgeCount > 0 && (
            <span className="header-profile-badge header-profile-badge-dot" aria-hidden="true" />
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
          onMarkRead={(id) => applyReadStateToNotificationItem(id, true)}
          onRollbackRead={(id) => applyReadStateToNotificationItem(id, false)}
        />
      )}
    </>
  );
}

export function HeaderDrawerAvatar() {
  const [mounted, setMounted] = useState(false);
  const iconImage = useHeaderSessionStore((state) => state.avatar);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  return (
    <span className="header-profile-link" aria-hidden="true">
      {iconImage ? (
        <img src={iconImage} className="header-profile-avatar" alt="avatar" />
      ) : (
        <UserRound className="header-profile-icon" width={20} height={20} strokeWidth={1.8} />
      )}
    </span>
  );
}
