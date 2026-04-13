"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type TouchEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import dynamic from "next/dynamic";
import { REVIEW_LIST_CACHE_TTL } from "@/lib/cache-config";

const UserReviewFeed = dynamic(() => import("./user-review-feed").then((mod) => ({ default: mod.UserReviewFeed })), {
  loading: () => <div className="user-review-feed" />,
});

const UserReviewAlbum = dynamic(() => import("./user-review-album").then((mod) => ({ default: mod.UserReviewAlbum })), {
  loading: () => <div className="user-review-album" />,
});

type ViewMode = "list" | "feed" | "album";
type SortMode = "latest" | "views" | "likes";

type UserReviewItem = {
  id: string;
  title: string;
  content: string;
  thumbnailImage: string | null;
  thumbnailSmall: string | null;
  thumbnailFirst: string | null;
  attachedFile: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  authorId: string;
  isAuthor?: boolean;
  board?: string;
  isPinned?: boolean;
  isGlobalPinned?: boolean;
};

type BoardType = "notice" | "review" | "qna" | "arao";

const BOARD_OPTIONS: Array<{ value: BoardType; label: string }> = [
  { value: "notice", label: "공지사항" },
  { value: "review", label: "사용자후기" },
  { value: "qna", label: "Q&A" },
  { value: "arao", label: "ARAO" },
];

const VIEW_OPTIONS: Array<{ value: ViewMode; label: string }> = [
  { value: "list", label: "목록형" },
  { value: "feed", label: "피드형" },
  { value: "album", label: "앨범형" },
];

const SORT_OPTIONS: Array<{ value: SortMode; label: string; icon: string }> = [
  { value: "latest", label: "최신순", icon: "●" },
  { value: "views", label: "조회수순", icon: "◐" },
  { value: "likes", label: "좋아요순", icon: "♥" },
];

function getFirstImage(thumbnailImage: string | null): string | null {
  if (!thumbnailImage) return null;
  try {
    const parsed = JSON.parse(thumbnailImage);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed[0] as string;
  } catch {
    // not JSON — use as-is
  }
  return thumbnailImage;
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "0000.00.00";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function excerpt(value: string, maxLength: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength)}...`;
}

const LIST_CACHE_KEY = "user-review-list-cache";
const SCROLL_KEY = "user-review-scroll";
const LIST_STATE_KEY = "user-review-list-state-v1";
const LIST_RETURN_FLAG_KEY = "user-review-return-once";
const LAST_OPENED_REVIEW_ID_KEY = "user-review-last-opened-id";
const CACHE_TTL = REVIEW_LIST_CACHE_TTL;
const BACKGROUND_REVALIDATE_COOLDOWN = 60000; // 1분
const TOP_REFRESH_COOLDOWN = 30000; // 30초
const TOP_REFRESH_LIMIT = 2;
const PAGE_CACHE_PREFIX = "user-review-page-cache-v1";

function canAggressivePrefetch(): boolean {
  if (typeof navigator === "undefined") return true;
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (!connection) return true;
  if (connection.saveData) return false;
  if (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g") return false;
  return true;
}

function getBoardListCacheKey(board: BoardType): string {
  return board === "review" ? LIST_CACHE_KEY : `${LIST_CACHE_KEY}-${board}`;
}

function getListCache(board: BoardType): { items: UserReviewItem[]; total: number } | null {
  try {
    const raw = sessionStorage.getItem(getBoardListCacheKey(board));
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: { items: UserReviewItem[]; total: number }; ts: number };
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function setListCache(board: BoardType, data: { items: UserReviewItem[]; total: number }) {
  try {
    // 첫 번째 이미지만 저장 (원본 배열 제외), thumbnailSmall 포함
    const slim = {
      ...data,
      items: data.items.map((item) => ({
        ...item,
        thumbnailImage: getFirstImage(item.thumbnailImage),
      })),
    };
    sessionStorage.setItem(getBoardListCacheKey(board), JSON.stringify({ data: slim, ts: Date.now() }));
    if (board === "review") {
      sessionStorage.setItem(LIST_CACHE_KEY, JSON.stringify({ data: slim, ts: Date.now() }));
    }
  } catch {}
}

function getPageCacheKey(params: {
  board: BoardType;
  page: number;
  limit: number;
  sort: SortMode;
  q: string;
}): string {
  return `${PAGE_CACHE_PREFIX}:${params.board}:${params.sort}:p${params.page}:l${params.limit}:q=${encodeURIComponent(params.q)}`;
}

function getPageCache(params: {
  board: BoardType;
  page: number;
  limit: number;
  sort: SortMode;
  q: string;
}): { items: UserReviewItem[]; total: number } | null {
  try {
    const raw = sessionStorage.getItem(getPageCacheKey(params));
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: { items: UserReviewItem[]; total: number }; ts: number };
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function setPageCache(
  params: { board: BoardType; page: number; limit: number; sort: SortMode; q: string },
  data: { items: UserReviewItem[]; total: number }
) {
  try {
    sessionStorage.setItem(getPageCacheKey(params), JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

function mergeTopItems(
  currentItems: UserReviewItem[],
  freshItems: UserReviewItem[],
  targetLength: number
): UserReviewItem[] {
  const existingIds = new Set(currentItems.map((item) => item.id));
  const newOnes = freshItems.filter((item) => !existingIds.has(item.id));
  if (newOnes.length === 0) return currentItems;
  const merged = [...newOnes, ...currentItems];
  return merged.slice(0, Math.max(targetLength, 0));
}

export function MainUserReviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn } = useUser();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  const [items, setItems] = useState<UserReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [board, setBoard] = useState<BoardType>("review");
  const [boardDropdownOpen, setBoardDropdownOpen] = useState(false);
  const boardDropdownRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [returnHighlightedId, setReturnHighlightedId] = useState<string | null>(null);
  const returnHighlightedIdRef = useRef<string | null>(null);
  const [returnMarkedId, setReturnMarkedId] = useState<string | null>(null);
  const [newItemId, setNewItemId] = useState<string | null>(null);
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  const [searchSheetClosing, setSearchSheetClosing] = useState(false);
  const [searchSheetDragY, setSearchSheetDragY] = useState(0);
  const [searchSheetLoading, setSearchSheetLoading] = useState(false);
  const [searchSheetResults, setSearchSheetResults] = useState<UserReviewItem[]>([]);
  const [searchSheetTotal, setSearchSheetTotal] = useState(0);
  const [searchSheetKeyword, setSearchSheetKeyword] = useState("");
  const backgroundApplyResumeAtRef = useRef(0);
  const didRestoreScrollRef = useRef(false);
  const searchSheetDraggingRef = useRef(false);
  const searchSheetDragStartYRef = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [writeFabMounted, setWriteFabMounted] = useState(false);
  const backgroundRefreshRunningRef = useRef(false);
  const lastBackgroundRefreshRef = useRef(0);
  const topRefreshRunningRef = useRef(false);
  const lastTopRefreshRef = useRef(0);
  const currentListStateRef = useRef<{
    board: BoardType;
    page: number;
    sortMode: SortMode;
    query: string;
  }>({ board: "review", page: 1, sortMode: "latest", query: "" });
  const itemsRef = useRef<UserReviewItem[]>([]);
  const totalRef = useRef(0);
  const limit = 20;

  useEffect(() => {
    currentListStateRef.current = {
      board,
      page,
      sortMode,
      query: query.trim(),
    };
  }, [board, page, sortMode, query]);

  useEffect(() => {
    returnHighlightedIdRef.current = returnHighlightedId;
    if (!returnHighlightedId) return;
    const timer = window.setTimeout(() => {
      setReturnHighlightedId((prev) => (prev === returnHighlightedId ? null : prev));
      returnHighlightedIdRef.current = null;
    }, 2100);
    return () => window.clearTimeout(timer);
  }, [returnHighlightedId]);

  useEffect(() => {
    itemsRef.current = items;
    totalRef.current = total;
  }, [items, total]);

  // 마운트 후 캐시 데이터로 즉시 채우기 + new 파라미터 처리
  useEffect(() => {
    const boardParam = searchParams.get("board");
    const restoreFlag = sessionStorage.getItem(LIST_RETURN_FLAG_KEY) === "1";
    const restoredRaw = restoreFlag ? sessionStorage.getItem(LIST_STATE_KEY) : null;
    let restoredState: {
      board?: BoardType;
      page?: number;
      sortMode?: SortMode;
      query?: string;
      viewMode?: ViewMode;
    } | null = null;
    if (restoredRaw) {
      try {
        const parsed = JSON.parse(restoredRaw) as {
          board?: BoardType;
          page?: number;
          sortMode?: SortMode;
          query?: string;
          viewMode?: ViewMode;
          ts?: number;
        };
        const isFresh = Number.isFinite(parsed.ts) ? Date.now() - Number(parsed.ts) < CACHE_TTL : true;
        if (isFresh) {
          restoredState = {
            board: parsed.board,
            page: Number.isFinite(parsed.page) ? Math.max(1, Math.trunc(parsed.page as number)) : 1,
            sortMode: parsed.sortMode,
            query: typeof parsed.query === "string" ? parsed.query : "",
            viewMode: parsed.viewMode,
          };
        }
      } catch {}
    }
    if (restoreFlag) {
      sessionStorage.removeItem(LIST_RETURN_FLAG_KEY);
    }
    if (restoreFlag) {
      const restoredReviewId = sessionStorage.getItem(LAST_OPENED_REVIEW_ID_KEY);
      if (restoredReviewId && restoredReviewId.trim()) {
        const nextId = restoredReviewId.trim();
        // 같은 글을 연속으로 열어도 복귀 시 애니메이션이 다시 재생되도록 강제 리셋
        setReturnHighlightedId(null);
        setReturnMarkedId(nextId);
        window.requestAnimationFrame(() => setReturnHighlightedId(nextId));
      } else {
        setReturnHighlightedId(null);
        setReturnMarkedId(null);
      }
    } else {
      setReturnHighlightedId(null);
      setReturnMarkedId(null);
    }

    const initialBoard =
      restoredState?.board && BOARD_OPTIONS.some((o) => o.value === restoredState.board)
        ? restoredState.board
        : boardParam && BOARD_OPTIONS.some((o) => o.value === boardParam)
        ? (boardParam as BoardType)
        : "review";
    const initialPage =
      restoredState?.page && Number.isFinite(restoredState.page) ? Math.max(1, Math.trunc(restoredState.page)) : 1;
    const initialSort =
      restoredState?.sortMode && SORT_OPTIONS.some((opt) => opt.value === restoredState.sortMode)
        ? restoredState.sortMode
        : "latest";
    const initialQuery = restoredState?.query ?? "";
    const initialViewMode =
      restoredState?.viewMode && VIEW_OPTIONS.some((opt) => opt.value === restoredState.viewMode)
        ? restoredState.viewMode
        : "list";

    setBoard(initialBoard);
    setPage(initialPage);
    setSortMode(initialSort);
    setQuery(initialQuery);
    setQueryInput(initialQuery);
    setViewMode(initialViewMode);

    const pageCached = getPageCache({
      board: initialBoard,
      page: initialPage,
      limit,
      sort: initialSort,
      q: initialQuery.trim(),
    });
    if (pageCached) {
      setItems(pageCached.items);
      setTotal(pageCached.total);
    } else {
      const cached = getListCache(initialBoard);
      if (cached) {
        setItems(cached.items);
        setTotal(cached.total);
      }
    }
    try {
      const stored = localStorage.getItem("user-review-read-ids");
      if (stored) setReadIds(new Set(JSON.parse(stored) as string[]));
    } catch {}

    const newId = searchParams.get("new");
    if (newId) {
      setNewItemId(newId);
      router.replace(initialBoard === "review" ? "/user_review" : `/user_review?board=${initialBoard}`);
    }
  }, []);

  useEffect(() => {
    const openSearchSheet = () => {
      setSearchSheetDragY(0);
      setSearchSheetClosing(false);
      setSearchSheetOpen(true);
    };
    window.addEventListener("community-search-open", openSearchSheet);
    return () => window.removeEventListener("community-search-open", openSearchSheet);
  }, []);

  useEffect(() => {
    setWriteFabMounted(true);
  }, []);

  useEffect(() => {
    if (!searchSheetOpen) return;
    const timer = window.setTimeout(() => searchInputRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [searchSheetOpen]);

  useEffect(() => {
    if (!searchSheetOpen) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [searchSheetOpen]);

  function isCacheFresh(key: string): boolean {
    try {
      const cached = sessionStorage.getItem(key);
      if (!cached) return false;
      const { ts } = JSON.parse(cached) as { ts: number };
      return Date.now() - ts < 60000;
    } catch { return false; }
  }

  function prefetchContentOnly(id: string) {
    const contentKey = `user-review-content-${id}`;
    if (!isCacheFresh(contentKey)) {
      fetch(`/api/main/user-review/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) sessionStorage.setItem(contentKey, JSON.stringify({ data, ts: Date.now() }));
        })
        .catch(() => {});
    }
  }

  // 상위 N개 좋아요/댓글 묶음 호출 후 캐시 저장
  function prefetchBatchInteractions(ids: string[]) {
    const uncachedIds = ids.filter(
      (id) => !isCacheFresh(`user-review-likes-${id}`) || !isCacheFresh(`user-review-comments-${id}`)
    );
    if (uncachedIds.length === 0) return;

    fetch("/api/main/user-review/batch-interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: uncachedIds }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((res: { results?: Record<string, { likes: { likeCount: number; liked: boolean }; comments: { comments: unknown[] } }> } | null) => {
        if (!res?.results) return;
        const now = Date.now();
        for (const [id, data] of Object.entries(res.results)) {
          sessionStorage.setItem(`user-review-likes-${id}`, JSON.stringify({ data: data.likes, ts: now }));
          sessionStorage.setItem(`user-review-comments-${id}`, JSON.stringify({ data: data.comments, ts: now }));
        }
      })
      .catch(() => {});
  }

  // 아이템 로드 후 상위 10개 router.prefetch + API 데이터 캐시 (새글 우선)
  // readIds는 화면 표시용이므로 의존성에서 제외 — items가 바뀔 때만 실행
  useEffect(() => {
    if (items.length === 0 || !isSignedIn) return;
    const aggressive = canAggressivePrefetch();
    const routePrefetchCount = aggressive ? 10 : 4;
    const interactionPrefetchCount = aggressive ? 10 : 3;

    const sorted = [
      ...items.filter((item) => !readIds.has(item.id)),
      ...items.filter((item) => readIds.has(item.id)),
    ];
    const sliced = sorted.slice(0, routePrefetchCount);

    sliced.forEach((item) => {
      router.prefetch(`/user_content/${item.id}`);
      prefetchContentOnly(item.id);
    });

    // 좋아요/댓글은 묶음 1회 호출
    prefetchBatchInteractions(sliced.slice(0, interactionPrefetchCount).map((item) => item.id));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, isSignedIn]);

  // 스크롤 하단 도달 시 나머지 10개 동시 prefetch + API 데이터 캐시
  useEffect(() => {
    if (items.length <= 10 || !isSignedIn) return;
    if (!canAggressivePrefetch()) return;
    const el = bottomSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        observer.disconnect();
        const sorted = [
          ...items.filter((item) => !readIds.has(item.id)),
          ...items.filter((item) => readIds.has(item.id)),
        ];
        sorted.slice(10).forEach((item) => {
          router.prefetch(`/user_content/${item.id}`);
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [items, readIds, isSignedIn]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!boardDropdownOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (boardDropdownRef.current && !boardDropdownRef.current.contains(event.target as Node)) {
        setBoardDropdownOpen(false);
      }
    };
    window.addEventListener("mousedown", onClickOutside);

    // 드롭다운 열리는 순간 notice + qna 병렬 캐싱
    const boardsToPrefetch: Array<{ board: string; cacheKey: string }> = [
      { board: "notice", cacheKey: `${LIST_CACHE_KEY}-notice` },
      { board: "qna", cacheKey: `${LIST_CACHE_KEY}-qna` },
    ];
    for (const { board: b, cacheKey } of boardsToPrefetch) {
      try {
        const raw = sessionStorage.getItem(cacheKey);
        if (raw) {
          const { ts } = JSON.parse(raw) as { ts: number };
          if (Date.now() - ts < CACHE_TTL) continue;
        }
      } catch {}
      fetch(`/api/main/user-review?page=1&limit=20&sort=latest&board=${b}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { items?: Array<{ id?: string; thumbnailImage?: string | null; thumbnailFirst?: string | null; [key: string]: unknown }>; [key: string]: unknown } | null) => {
          if (!data || !Array.isArray(data.items)) return;
          const slim = {
            ...data,
            items: data.items.map((item) => {
              let firstImage: string | null = null;
              if (item.thumbnailImage) {
                try {
                  const parsed = JSON.parse(item.thumbnailImage as string);
                  firstImage = Array.isArray(parsed) ? (parsed[0] ?? null) : item.thumbnailImage as string;
                } catch { firstImage = item.thumbnailImage as string; }
              }
              return { ...item, thumbnailImage: firstImage, thumbnailFirst: item.thumbnailFirst ?? null };
            }),
          };
          sessionStorage.setItem(cacheKey, JSON.stringify({ data: slim, ts: Date.now() }));
          // 좋아요/댓글 묶음 캐싱
          const ids = slim.items.map((item) => item.id).filter((id): id is string => typeof id === "string");
          if (ids.length > 0) {
            fetch("/api/main/user-review/batch-interactions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids }),
            })
              .then((r) => (r.ok ? r.json() : null))
              .then((res: { results?: Record<string, { likes: unknown; comments: unknown }> } | null) => {
                if (!res?.results) return;
                const now = Date.now();
                for (const [id, d] of Object.entries(res.results)) {
                  sessionStorage.setItem(`user-review-likes-${id}`, JSON.stringify({ data: d.likes, ts: now }));
                  sessionStorage.setItem(`user-review-comments-${id}`, JSON.stringify({ data: d.comments, ts: now }));
                }
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    }

    return () => window.removeEventListener("mousedown", onClickOutside);
  }, [boardDropdownOpen]);

  // 페이지 이동 복귀 시 스크롤 위치 복원
  useEffect(() => {
    if (didRestoreScrollRef.current) return;
    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (saved && items.length > 0) {
      didRestoreScrollRef.current = true;
      requestAnimationFrame(() => {
        window.scrollTo(0, Number(saved));
        sessionStorage.removeItem(SCROLL_KEY);
      });
    }
  }, [items.length]);

  // 스크롤 위치 저장 (글 클릭 시)
  const saveScroll = () => {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
  };

  const refreshListInBackground = useCallback(async () => {
    if (Date.now() < backgroundApplyResumeAtRef.current) return;
    const normalizedQuery = query.trim();
    if (page !== 1 || sortMode !== "latest" || normalizedQuery) return;
    if (!canAggressivePrefetch()) return;
    if (backgroundRefreshRunningRef.current) return;
    const now = Date.now();
    if (now - lastBackgroundRefreshRef.current < BACKGROUND_REVALIDATE_COOLDOWN) return;

    backgroundRefreshRunningRef.current = true;
    lastBackgroundRefreshRef.current = now;
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: String(limit),
        sort: "latest",
        board,
      });
      const res = await fetch(`/api/main/user-review?${params.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as { items?: UserReviewItem[]; total?: number };
      const nextItems = Array.isArray(data.items) ? data.items : [];
      const nextTotal = data.total ?? 0;
      const current = currentListStateRef.current;
      if (
        current.board === board &&
        current.page === 1 &&
        current.sortMode === "latest" &&
        !current.query &&
        Date.now() >= backgroundApplyResumeAtRef.current &&
        !returnHighlightedIdRef.current
      ) {
        setItems(nextItems);
        setTotal(nextTotal);
      }
      setPageCache(
        { board, page: 1, limit, sort: "latest", q: "" },
        { items: nextItems, total: nextTotal }
      );
      setListCache(board, { items: nextItems, total: nextTotal });
    } catch {}
    finally {
      backgroundRefreshRunningRef.current = false;
    }
  }, [board, page, query, sortMode, limit]);

  const refreshTopItemsInBackground = useCallback(async () => {
    if (Date.now() < backgroundApplyResumeAtRef.current) return;
    const normalizedQuery = query.trim();
    if (page !== 1 || sortMode !== "latest" || normalizedQuery) return;
    if (!canAggressivePrefetch()) return;
    if (topRefreshRunningRef.current) return;
    const now = Date.now();
    if (now - lastTopRefreshRef.current < TOP_REFRESH_COOLDOWN) return;

    topRefreshRunningRef.current = true;
    lastTopRefreshRef.current = now;
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: String(TOP_REFRESH_LIMIT),
        sort: "latest",
        board,
      });
      const res = await fetch(`/api/main/user-review?${params.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as { items?: UserReviewItem[]; total?: number };
      const freshItems = Array.isArray(data.items) ? data.items : [];
      if (freshItems.length === 0) return;

      const currentState = currentListStateRef.current;
      if (
        currentState.board !== board ||
        currentState.page !== 1 ||
        currentState.sortMode !== "latest" ||
        currentState.query ||
        Date.now() < backgroundApplyResumeAtRef.current ||
        returnHighlightedIdRef.current
      ) {
        return;
      }

      const merged = mergeTopItems(itemsRef.current, freshItems, Math.max(itemsRef.current.length, limit));
      if (merged === itemsRef.current) return;
      const nextTotal = Math.max(totalRef.current, data.total ?? totalRef.current);
      setItems(merged);
      setTotal(nextTotal);
      setPageCache(
        { board, page: 1, limit, sort: "latest", q: "" },
        { items: merged, total: nextTotal }
      );
      setListCache(board, { items: merged, total: nextTotal });
    } catch {}
    finally {
      topRefreshRunningRef.current = false;
    }
  }, [board, page, query, sortMode, limit]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const normalizedQuery = query.trim();
      const pageCache = getPageCache({
        board,
        page,
        limit,
        sort: sortMode,
        q: normalizedQuery,
      });
      if (pageCache) {
        setItems(pageCache.items);
        setTotal(pageCache.total);
        void refreshTopItemsInBackground();
        void refreshListInBackground();
        return;
      }

      // page=1, sort=latest, 검색 없을 때 게시판별 메인 캐시 우선 사용
      if (page === 1 && sortMode === "latest" && !normalizedQuery) {
        const cached = getListCache(board);
        if (cached) {
          setItems(cached.items);
          setTotal(cached.total);
          setPageCache(
            { board, page, limit, sort: sortMode, q: normalizedQuery },
            { items: cached.items, total: cached.total }
          );
          void refreshTopItemsInBackground();
          void refreshListInBackground();
          return;
        }
      }
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          sort: sortMode,
          board,
        });
        if (normalizedQuery) params.set("q", normalizedQuery);

        const res = await fetch(`/api/main/user-review?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch user reviews");
        const data = (await res.json()) as {
          items: UserReviewItem[];
          total: number;
        };
        const newItems = Array.isArray(data.items) ? data.items : [];
        setItems(newItems);
        setTotal(data.total ?? 0);
        setPageCache(
          { board, page, limit, sort: sortMode, q: normalizedQuery },
          { items: newItems, total: data.total ?? 0 }
        );
        // page=1, sort=latest, 검색 없을 때 게시판별 캐시 저장
        if (page === 1 && sortMode === "latest" && !normalizedQuery) {
          setListCache(board, { items: newItems, total: data.total ?? 0 });
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("MainUserReviewPage fetch error:", error);
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [page, limit, sortMode, query, board]);

  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState !== "visible") return;
      void refreshListInBackground();
    };
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    return () => {
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [refreshListInBackground]);

  useEffect(() => {
    if (loading || total <= page * limit) return;
    if (!canAggressivePrefetch()) return;
    const normalizedQuery = query.trim();
    const nextPage = page + 1;
    const cacheParams = {
      board,
      page: nextPage,
      limit,
      sort: sortMode,
      q: normalizedQuery,
    } as const;
    if (getPageCache(cacheParams)) return;

    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(nextPage),
      limit: String(limit),
      sort: sortMode,
      board,
    });
    if (normalizedQuery) params.set("q", normalizedQuery);

    const idleWindow = window as Window & {
      requestIdleCallback?: (fn: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const useIdle = typeof idleWindow.requestIdleCallback === "function";
    const timerId = useIdle
      ? idleWindow.requestIdleCallback?.(() => {
          fetch(`/api/main/user-review?${params.toString()}`, { signal: controller.signal })
            .then((res) => (res.ok ? res.json() : null))
            .then((data: { items?: UserReviewItem[]; total?: number } | null) => {
              if (!data) return;
              setPageCache(cacheParams, {
                items: Array.isArray(data.items) ? data.items : [],
                total: data.total ?? 0,
              });
            })
            .catch(() => {});
        }, { timeout: 1200 })
      : window.setTimeout(() => {
          fetch(`/api/main/user-review?${params.toString()}`, { signal: controller.signal })
            .then((res) => (res.ok ? res.json() : null))
            .then((data: { items?: UserReviewItem[]; total?: number } | null) => {
              if (!data) return;
              setPageCache(cacheParams, {
                items: Array.isArray(data.items) ? data.items : [],
                total: data.total ?? 0,
              });
            })
            .catch(() => {});
        }, 200);

    return () => {
      controller.abort();
      if (!timerId) return;
      if (useIdle && typeof idleWindow.cancelIdleCallback === "function") {
        idleWindow.cancelIdleCallback(timerId);
      } else {
        window.clearTimeout(timerId);
      }
    };
  }, [board, page, total, limit, sortMode, query, loading]);

  const totalPages = Math.max(Math.ceil(total / limit), 1);

  const visiblePages = useMemo(() => {
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    const pages: number[] = [];
    for (let i = start; i <= end; i += 1) pages.push(i);
    return pages;
  }, [page, totalPages]);

  const activeViewLabel =
    VIEW_OPTIONS.find((opt) => opt.value === viewMode)?.label ?? "목록형";

  const openReview = (id: string) => {
    if (!isSignedIn && board !== "qna") {
      router.push("/sign-in");
      return;
    }
    if (id === newItemId) setNewItemId(null);
    backgroundApplyResumeAtRef.current = Number.POSITIVE_INFINITY;
    saveScroll();
    try {
      sessionStorage.setItem(LAST_OPENED_REVIEW_ID_KEY, id);
      sessionStorage.setItem(
        LIST_STATE_KEY,
        JSON.stringify({ board, page, sortMode, query: query.trim(), viewMode, ts: Date.now() })
      );
      sessionStorage.setItem(LIST_RETURN_FLAG_KEY, "1");
    } catch {}
    const targetPath = `/user_content/${id}?board=${encodeURIComponent(board)}`;
    // 헤더 즉시 숨기기
    const header = document.querySelector(".site-header") as HTMLElement | null;
    if (header) header.style.visibility = "hidden";
    router.push(targetPath, { scroll: false });
  };

  function closeSearchSheet() {
    if (!searchSheetOpen || searchSheetClosing) return;
    setSearchSheetDragY(0);
    setSearchSheetClosing(true);
    window.setTimeout(() => {
      setSearchSheetOpen(false);
      setSearchSheetClosing(false);
    }, 280);
  }

  function submitSearchFromSheet() {
    const keyword = queryInput.trim();
    if (!keyword) {
      setSearchSheetResults([]);
      setSearchSheetTotal(0);
      setSearchSheetKeyword("");
      return;
    }
    setSearchSheetLoading(true);
    setSearchSheetKeyword(keyword);
    const params = new URLSearchParams({
      board,
      page: "1",
      limit: "20",
      sort: "latest",
      q: keyword,
    });
    fetch(`/api/main/user-review?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { items?: UserReviewItem[]; total?: number } | null) => {
        setSearchSheetResults(Array.isArray(data?.items) ? data.items : []);
        setSearchSheetTotal(data?.total ?? 0);
      })
      .catch(() => {
        setSearchSheetResults([]);
        setSearchSheetTotal(0);
      })
      .finally(() => {
        setSearchSheetLoading(false);
      });
  }

  function onSearchSheetDragStart(e: TouchEvent<HTMLDivElement>) {
    searchSheetDraggingRef.current = true;
    searchSheetDragStartYRef.current = e.touches[0].clientY;
  }

  function onSearchSheetDragMove(e: TouchEvent<HTMLDivElement>) {
    if (!searchSheetDraggingRef.current) return;
    const diff = e.touches[0].clientY - searchSheetDragStartYRef.current;
    if (diff > 0) setSearchSheetDragY(diff);
  }

  function onSearchSheetDragEnd() {
    if (!searchSheetDraggingRef.current) return;
    searchSheetDraggingRef.current = false;
    if (searchSheetDragY > 80) {
      closeSearchSheet();
      return;
    }
    setSearchSheetDragY(0);
  }

  const searchSheetStyle: CSSProperties = {
    transform: searchSheetClosing
      ? "translateY(100%)"
      : searchSheetDragY > 0
        ? `translateY(${searchSheetDragY}px)`
        : undefined,
    transition: searchSheetDraggingRef.current
      ? "none"
      : "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
  };

  return (
    <section className="user-review-page">
      <div className="user-review-top-row">
        <div className="user-review-dropdown" ref={boardDropdownRef}>
          <button
            type="button"
            className="user-review-dropdown-trigger"
            onClick={() => setBoardDropdownOpen((v) => !v)}
          >
            {BOARD_OPTIONS.find((o) => o.value === board)?.label ?? "사용자후기"}
            <span className={`user-review-dropdown-arrow${boardDropdownOpen ? " open" : ""}`}>▾</span>
          </button>
          {boardDropdownOpen && (
            <div className="user-review-dropdown-menu">
              {BOARD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`user-review-dropdown-option${board === opt.value ? " active" : ""}`}
                  onClick={() => {
                    setBoard(opt.value);
                    setBoardDropdownOpen(false);
                    setPage(1);
                    setQuery("");
                    setQueryInput("");
                    router.replace(opt.value === "review" ? "/user_review" : `/user_review?board=${opt.value}`);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="user-review-dropdown" ref={dropdownRef}>
          <button
            type="button"
            className="user-review-dropdown-trigger"
            onClick={() => setDropdownOpen((v) => !v)}
          >
            {activeViewLabel}
            <span className={`user-review-dropdown-arrow${dropdownOpen ? " open" : ""}`}>▾</span>
          </button>
          {dropdownOpen && (
            <div className="user-review-dropdown-menu">
              {VIEW_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`user-review-dropdown-option${viewMode === opt.value ? " active" : ""}`}
                  onClick={() => {
                    setViewMode(opt.value);
                    setDropdownOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {viewMode === "list" && (
          <div className="user-review-sort-row">
            {SORT_OPTIONS.map((opt, i) => (
              <span key={opt.value} style={{ display: "inline-flex", alignItems: "center" }}>
                {i > 0 && <span className="user-review-sort-sep" aria-hidden="true">|</span>}
                <button
                  type="button"
                  className={`user-review-sort-btn${sortMode === opt.value ? " active" : ""}`}
                  onClick={() => {
                    setSortMode(opt.value);
                    setPage(1);
                  }}
                >
                  {opt.label}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {loading && items.length === 0 ? (
        <div className="user-review-list">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton-row">
              <div className="skeleton-row-body">
                <div className="skeleton-bone skeleton-title" style={i % 3 === 1 ? { width: "50%" } : i % 3 === 2 ? { width: "80%" } : undefined} />
                <div className="skeleton-bone skeleton-meta" style={i % 2 === 1 ? { width: "35%" } : undefined} />
              </div>
              <div className="skeleton-bone skeleton-thumb" />
            </div>
          ))}
        </div>
      ) : items.length === 0 && !loading ? (
        <div className="user-review-empty">표시할 후기가 없습니다.</div>
      ) : viewMode === "list" ? (
        <div className="user-review-list">
          {items.map((item) => {
            const thumb = item.thumbnailFirst ?? getFirstImage(item.thumbnailImage);
            const pinned = item.isPinned || item.isGlobalPinned;
            if (pinned) {
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`user-review-item list is-pinned${item.isGlobalPinned ? " is-global" : ""}${readIds.has(item.id) ? " read" : ""}${item.isAuthor ? " mine" : ""}${returnHighlightedId === item.id ? " return-flash" : ""}`}
                  onClick={() => openReview(item.id)}
                >
                  <p className="user-review-item-title user-review-item-title-pinned">
                    <span className={`user-review-pin-badge${item.isGlobalPinned ? " is-global" : ""}`}>
                      {item.isGlobalPinned ? "필독" : "공지"}
                    </span>
                    {item.title}
                  </p>
                </button>
              );
            }
            return (
                <button
                  key={item.id}
                  type="button"
                  className={`user-review-item list${readIds.has(item.id) ? " read" : ""}${item.isAuthor ? " mine" : ""}${returnHighlightedId === item.id ? " return-flash" : ""}`}
                  onClick={() => openReview(item.id)}
                >
                <div className="user-review-item-main">
                  <p className="user-review-item-title">
                    {!readIds.has(item.id) && <span className="user-review-unread-dot" aria-label="읽지 않음" />}
                    {returnMarkedId === item.id && <strong>{">"} </strong>}
                    {item.title.length > 21 ? `${item.title.slice(0, 20)}...` : item.title}
                    {item.id === newItemId && <span className="user-review-item-new-badge">NEW</span>}
                  </p>
                  <p className="user-review-item-meta">
                    <span>{item.authorId}</span>
                    <span>{formatDate(item.createdAt)}</span>
                    <span>조회 {item.viewCount}</span>
                    {(item.attachedFile || item.likeCount > 0 || item.commentCount > 0) && (
                      <span className="user-review-item-meta-icons">
                        {item.attachedFile && (
                          <svg className="user-review-item-clip" aria-label="첨부파일" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        )}
                        {item.likeCount > 0 && (
                          <span className="user-review-item-stat">
                            <svg className="user-review-item-heart" aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                            {item.likeCount}
                          </span>
                        )}
                        {item.commentCount > 0 && (
                          <span className="user-review-item-stat">
                            <svg className="user-review-item-comment" aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            {item.commentCount}
                          </span>
                        )}
                      </span>
                    )}
                  </p>
                </div>
                <div className="user-review-item-thumb">
                  {thumb ? (
                    <img src={thumb} alt="" loading="lazy" />
                  ) : (
                    <span className="user-review-item-thumb-empty" aria-hidden="true">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : viewMode === "feed" ? (
        <UserReviewFeed items={items} readIds={readIds} onOpenReview={openReview} />
      ) : (
        <UserReviewAlbum items={items} readIds={readIds} onOpenReview={openReview} />
      )}

      <div ref={bottomSentinelRef} aria-hidden="true" />

      <div className="user-review-bottom">
        <div className="user-review-pagination-row">
          <div className="user-review-pagination">
            <button
              type="button"
              className="user-review-page-btn"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
            >
              이전
            </button>
            {visiblePages.map((num) => (
              <button
                key={num}
                type="button"
                className={`user-review-page-btn${num === page ? " active" : ""}`}
                onClick={() => setPage(num)}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              className="user-review-page-btn"
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
            >
              다음
            </button>
          </div>

          <button
            type="button"
            className="user-review-write-btn"
            onClick={() => {
              if (!isSignedIn) { router.push("/sign-in"); return; }
              router.push(`/write_review?board=${board}`);
            }}
            aria-label={writeFabMounted ? "새글작성" : undefined}
            title={writeFabMounted ? "새글작성" : undefined}
          >
            {writeFabMounted ? (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
                </svg>
                <span className="user-review-sr-only">새글작성</span>
              </>
            ) : (
              "글작성"
            )}
          </button>
        </div>
      </div>

      {searchSheetOpen && (
        <div
          className={`user-review-search-sheet-overlay${searchSheetClosing ? " is-closing" : ""}`}
          onClick={closeSearchSheet}
        >
          <div
            className="user-review-search-sheet-panel"
            style={searchSheetStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="user-review-search-sheet-drag-area"
              onTouchStart={onSearchSheetDragStart}
              onTouchMove={onSearchSheetDragMove}
              onTouchEnd={onSearchSheetDragEnd}
            >
              <div className="user-review-search-sheet-handle" />
              <form
                className="user-review-search-sheet-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitSearchFromSheet();
                }}
              >
                <button
                  type="button"
                  className="user-review-search-sheet-close"
                  aria-label="검색창 닫기"
                  onClick={closeSearchSheet}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
                <input
                  ref={searchInputRef}
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="아이디/제목/본문 검색"
                  className="user-review-search-sheet-input"
                />
                <button type="submit" className="user-review-search-sheet-submit">
                  검색
                </button>
              </form>
            </div>
            <div className="user-review-search-sheet-body">
              <p className="user-review-search-sheet-hint">검색어를 입력하고 검색을 누르세요.</p>
              {searchSheetLoading && <p className="user-review-search-sheet-hint">검색 중...</p>}
              {!searchSheetLoading && searchSheetKeyword && (
                <p className="user-review-search-sheet-hint">
                  &quot;{searchSheetKeyword}&quot; 검색 결과 {searchSheetTotal}건
                </p>
              )}
              {!searchSheetLoading && searchSheetKeyword && searchSheetResults.length > 0 && (
                <ul className="user-review-search-sheet-result-list">
                  {searchSheetResults.map((result) => (
                    <li key={result.id}>
                      <button
                        type="button"
                        className={`user-review-search-sheet-result-item${result.isAuthor ? " mine" : ""}`}
                        onClick={() => {
                          closeSearchSheet();
                          openReview(result.id);
                        }}
                      >
                        <p className="user-review-search-sheet-result-title">{result.title || "(제목 없음)"}</p>
                        <p className="user-review-search-sheet-result-meta">
                          <span>{result.authorId}</span>
                          <span>{formatDate(result.createdAt)}</span>
                          <span>ID {result.id.slice(0, 8)}</span>
                        </p>
                        <p className="user-review-search-sheet-result-content">
                          {excerpt(result.content, 120)}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!searchSheetLoading && searchSheetKeyword && searchSheetResults.length === 0 && (
                <p className="user-review-search-sheet-hint">검색 결과가 없습니다.</p>
              )}
              {(searchSheetKeyword || queryInput.trim()) && (
                <button
                  type="button"
                  className="user-review-search-sheet-clear"
                  onClick={() => {
                    setQueryInput("");
                    setSearchSheetKeyword("");
                    setSearchSheetResults([]);
                    setSearchSheetTotal(0);
                    setQuery("");
                    setPage(1);
                  }}
                >
                  현재 검색 해제
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
