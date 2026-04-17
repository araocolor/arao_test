"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Bookmark } from "lucide-react";
import type { ColorItem } from "@/lib/color-types";

type ColorSortMode = "bookmark" | "download" | "purchase";
type ColorViewMode = "album" | "card";

function toTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareByRecent(a: ColorItem, b: ColorItem): number {
  return toTimestamp(b.created_at) - toTimestamp(a.created_at);
}

function ColorCard({ item, onClick }: { item: ColorItem; onClick: () => void }) {
  const mid = item.img_arao_mid ?? item.img_arao_thumb ?? null;
  const full = item.img_arao_full ?? null;
  const [src, setSrc] = useState(mid ?? full);
  const upgradedRef = useRef(false);

  useEffect(() => {
    if (upgradedRef.current || !full || full === mid) return;
    upgradedRef.current = true;
    const img = new window.Image();
    img.onload = () => setSrc(full);
    img.src = full;
  }, [full, mid]);

  return (
    <article className="color-card" onClick={onClick} style={{ cursor: "pointer" }}>
      <div className="color-card-price-row">
        <p className="color-card-title">{item.title}</p>
        {item.price != null ? (
          <span className="color-card-price">{item.price.toLocaleString()}원</span>
        ) : (
          <span />
        )}
      </div>
      <div className="color-card-image-wrap">
        {src ? (
          <Image
            src={src}
            alt={item.title}
            fill
            className="color-card-image"
            sizes="(max-width: 480px) 50vw, 274px"
          />
        ) : (
          <div className="color-card-image-placeholder">이미지 없음</div>
        )}
        <div className="color-card-heart">
          <Bookmark size={16} strokeWidth={2} fill="currentColor" />
          <span>{item.like_count}</span>
        </div>
        {item.content && (
          <div className="color-card-overlay-title">
            <span className="color-card-overlay-content-text">{item.content}</span>
          </div>
        )}
      </div>
    </article>
  );
}

function preloadImages(urls: (string | null | undefined)[]): Promise<void> {
  return Promise.all(
    urls.filter(Boolean).map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new window.Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = src!;
        })
    )
  ).then(() => undefined);
}

export function ColorGrid({ items }: { items: ColorItem[] }) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [sortMode, setSortMode] = useState<ColorSortMode>("bookmark");
  const [viewMode, setViewMode] = useState<ColorViewMode>("album");

  useEffect(() => {
    const role = sessionStorage.getItem("user-role");
    setIsAdmin(role === "admin");
  }, []);

  // 컬러 페이지 진입 후 나머지 이미지 순차 프리로드
  useEffect(() => {
    void (async () => {
      await preloadImages(items.map((i) => i.img_arao_full));
      await preloadImages(items.map((i) => i.img_portrait_full));
      await preloadImages(items.map((i) => i.img_standard_full));
    })();
  }, [items]);

  const handleClick = (item: ColorItem) => {
    try {
      const thumb = item.img_arao_thumb ?? item.img_arao_mid ?? null;
      sessionStorage.setItem(
        `color-detail-instant-${item.id}`,
        JSON.stringify({ id: item.id, title: item.title, thumb })
      );
      // 전체 목록도 캐시 저장
      sessionStorage.setItem("color-items", JSON.stringify(items));
    } catch {}
    router.push(`/color/${item.id}`);
  };

  const visibleItems = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase();
    const filtered = normalizedKeyword
      ? items.filter((item) => {
          const title = item.title.toLowerCase();
          const content = (item.content ?? "").toLowerCase();
          const productCode = (item.product_code ?? "").toLowerCase();
          return (
            title.includes(normalizedKeyword) ||
            content.includes(normalizedKeyword) ||
            productCode.includes(normalizedKeyword)
          );
        })
      : items;

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortMode === "bookmark") {
        if (b.like_count !== a.like_count) {
          return b.like_count - a.like_count;
        }
        return compareByRecent(a, b);
      }

      if (sortMode === "download") {
        const downloadA = a.file_link ? 1 : 0;
        const downloadB = b.file_link ? 1 : 0;
        if (downloadB !== downloadA) {
          return downloadB - downloadA;
        }
        if (b.like_count !== a.like_count) {
          return b.like_count - a.like_count;
        }
        return compareByRecent(a, b);
      }

      const purchasableA = (a.price ?? 0) > 0 ? 1 : 0;
      const purchasableB = (b.price ?? 0) > 0 ? 1 : 0;
      if (purchasableB !== purchasableA) {
        return purchasableB - purchasableA;
      }
      if ((b.price ?? 0) !== (a.price ?? 0)) {
        return (b.price ?? 0) - (a.price ?? 0);
      }
      return compareByRecent(a, b);
    });

    return sorted;
  }, [items, searchKeyword, sortMode]);

  return (
    <>
      <section className="color-search-card" aria-label="컬러 검색 및 정렬">
        <div className="color-search-head">
          <p className="color-search-title">컬러 검색</p>
          <span className="color-search-count">{visibleItems.length}개</span>
        </div>
        <div className="color-search-controls">
          <input
            type="search"
            className="color-search-input"
            placeholder="제목, 내용, 상품코드 검색"
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            aria-label="컬러 검색"
          />
          <div className="color-view-toggle" role="group" aria-label="보기 방식">
            <button
              type="button"
              className={`color-view-btn${viewMode === "album" ? " is-active" : ""}`}
              onClick={() => setViewMode("album")}
              aria-label="앨범형 보기"
              title="앨범형"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1.2" />
                <rect x="14" y="3" width="7" height="7" rx="1.2" />
                <rect x="3" y="14" width="7" height="7" rx="1.2" />
                <rect x="14" y="14" width="7" height="7" rx="1.2" />
              </svg>
            </button>
            <button
              type="button"
              className={`color-view-btn${viewMode === "card" ? " is-active" : ""}`}
              onClick={() => setViewMode("card")}
              aria-label="카드형 보기"
              title="카드형"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <line x1="7" y1="9" x2="17" y2="9" />
                <line x1="7" y1="13" x2="14" y2="13" />
              </svg>
            </button>
          </div>
          <select
            className="color-sort-select"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as ColorSortMode)}
            aria-label="정렬 방식"
          >
            <option value="bookmark">북마크순</option>
            <option value="download">다운로드순</option>
            <option value="purchase">구매순</option>
          </select>
        </div>
      </section>

      {visibleItems.length === 0 ? (
        <div className="color-empty">검색 결과가 없습니다.</div>
      ) : (
        <div className={`color-grid${viewMode === "card" ? " color-grid-card" : ""}`}>
          {visibleItems.map((item) => (
            <ColorCard key={item.id} item={item} onClick={() => handleClick(item)} />
          ))}
        </div>
      )}
      <button
        type="button"
        className="color-fab"
        aria-label="글쓰기"
        disabled={!isAdmin}
        onClick={() => router.push("/color/write")}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </>
  );
}
