"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

type ViewMode = "list" | "feed" | "album";
type SortMode = "latest" | "views" | "likes";

type UserReviewItem = {
  id: string;
  title: string;
  content: string;
  thumbnailImage: string | null;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  authorId: string;
};

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

export function MainUserReviewPage() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [items, setItems] = useState<UserReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const limit = 20;

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user-review-read-ids");
      if (stored) setReadIds(new Set(JSON.parse(stored) as string[]));
    } catch {}
  }, []);

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
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          sort: sortMode,
        });
        if (query.trim()) params.set("q", query.trim());

        const res = await fetch(`/api/main/user-review?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch user reviews");
        const data = (await res.json()) as {
          items: UserReviewItem[];
          total: number;
        };
        setItems(Array.isArray(data.items) ? data.items : []);
        setTotal(data.total ?? 0);
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
  }, [page, limit, sortMode, query]);

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
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem("user-review-read-ids", JSON.stringify([...next]));
      } catch {}
      return next;
    });
    router.push(`/user_content/${id}`);
  };

  return (
    <section className="user-review-page">
      <div className="user-review-top-row">
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
      </div>

      {viewMode === "list" && (
        <div className="user-review-sort-row">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`user-review-sort-btn${sortMode === opt.value ? " active" : ""}`}
              onClick={() => {
                setSortMode(opt.value);
                setPage(1);
              }}
            >
              <span className="user-review-sort-icon" aria-hidden="true">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="user-review-empty">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="user-review-empty">표시할 후기가 없습니다.</div>
      ) : viewMode === "list" ? (
        <div className="user-review-list">
          {items.map((item) => {
            const thumb = getFirstImage(item.thumbnailImage);
            return (
              <button
                key={item.id}
                type="button"
                className="user-review-item list"
                onClick={() => openReview(item.id)}
              >
                <div className="user-review-item-main">
                  <p className="user-review-item-title">
                    {!readIds.has(item.id) && <span className="user-review-unread-dot" aria-label="읽지 않음" />}
                    {item.title}
                  </p>
                  <p className="user-review-item-meta">
                    <span>{item.authorId}</span>
                    <span>{formatDate(item.createdAt)}</span>
                    <span>조회 {item.viewCount}</span>
                  </p>
                </div>
                <div className="user-review-item-thumb">
                  {thumb ? (
                    <img src={thumb} alt="" loading="lazy" />
                  ) : (
                    <span className="user-review-item-thumb-empty" aria-hidden="true" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : viewMode === "feed" ? (
        <div className="user-review-feed">
          {items.map((item) => {
            const thumb = getFirstImage(item.thumbnailImage);
            return (
              <button
                key={item.id}
                type="button"
                className="user-review-item feed"
                onClick={() => openReview(item.id)}
              >
                <div className="user-review-feed-thumb">
                  {thumb ? (
                    <img src={thumb} alt="" loading="lazy" />
                  ) : (
                    <span className="user-review-item-thumb-empty" aria-hidden="true" />
                  )}
                </div>
                <div className="user-review-feed-body">
                  <p className="user-review-item-title">
                    {!readIds.has(item.id) && <span className="user-review-unread-dot" aria-label="읽지 않음" />}
                    {item.title}
                  </p>
                  <p className="user-review-feed-text">{excerpt(item.content, 80)}</p>
                  <p className="user-review-item-meta">
                    <span>{item.authorId}</span>
                    <span>{formatDate(item.createdAt)}</span>
                    <span>조회 {item.viewCount}</span>
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="user-review-album">
          {items.map((item) => {
            const thumb = getFirstImage(item.thumbnailImage);
            return (
              <button
                key={item.id}
                type="button"
                className="user-review-item album"
                onClick={() => openReview(item.id)}
              >
                <div className="user-review-album-thumb">
                  {thumb ? (
                    <img src={thumb} alt="" loading="lazy" />
                  ) : (
                    <span className="user-review-item-thumb-empty" aria-hidden="true" />
                  )}
                </div>
                <p className="user-review-album-title">
                  {!readIds.has(item.id) && <span className="user-review-unread-dot" aria-label="읽지 않음" />}
                  {item.title}
                </p>
              </button>
            );
          })}
        </div>
      )}

      <div className="user-review-bottom">
        <div className="user-review-search-row">
          <input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="아이디/제목/본문 검색"
            className="user-review-search-input"
          />
          <button
            type="button"
            className="user-review-search-btn"
            onClick={() => {
              setPage(1);
              setQuery(queryInput.trim());
            }}
          >
            검색
          </button>
        </div>

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
            onClick={() => router.push("/write_review")}
          >
            글작성
          </button>
        </div>
      </div>
    </section>
  );
}

