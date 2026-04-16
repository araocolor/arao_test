"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { LandingPageHeader } from "@/components/landing-page-header";
import Image from "next/image";

const COLOR_CACHE_KEY = "color-items";
const COLOR_PREFETCH_CACHE_KEY = "color-list-cache";

type ColorItem = {
  id: string;
  title: string;
  content: string | null;
  price: number | null;
  file_link: string | null;
  img_arao_full: string | null;
  img_arao_mid: string | null;
  img_arao_thumb: string | null;
  like_count: number;
  created_at: string;
  is_admin: boolean;
};

type PrefetchItem = {
  id: string;
  title: string;
  like_count: number;
  img_arao_mid: string | null;
};

function getPrefetchItems(): PrefetchItem[] {
  try {
    const raw = sessionStorage.getItem(COLOR_PREFETCH_CACHE_KEY);
    if (!raw) return [];
    const { data } = JSON.parse(raw) as { data: PrefetchItem[] };
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// mid(480)로 먼저 표시 후, full 로드 완료 시 교체
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
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

function getInitialItems(): { items: ColorItem[]; hasCache: boolean } {
  try {
    // 1순위: 이전 방문 full 캐시
    const raw = sessionStorage.getItem(COLOR_CACHE_KEY);
    if (raw) {
      const items = JSON.parse(raw) as ColorItem[];
      if (Array.isArray(items) && items.length > 0) return { items, hasCache: true };
    }
    // 2순위: 햄버거 프리캐시 (mid)
    const prefetched = getPrefetchItems();
    if (prefetched.length > 0) {
      return {
        items: prefetched.map((p) => ({
          id: p.id,
          title: p.title,
          like_count: p.like_count,
          img_arao_mid: p.img_arao_mid,
          img_arao_full: null,
          img_arao_thumb: null,
          content: null,
          price: null,
          file_link: null,
          created_at: "",
          is_admin: false,
        })),
        hasCache: true,
      };
    }
  } catch {}
  return { items: [], hasCache: false };
}

export default function ColorPage() {
  const router = useRouter();
  const [items, setItems] = useState<ColorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const role = sessionStorage.getItem("user-role");
    setIsAdmin(role === "admin");
  }, []);

  // 마운트 직후 캐시 즉시 반영
  useEffect(() => {
    const { items: cached, hasCache } = getInitialItems();
    if (hasCache) {
      setItems(cached);
      setLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/color?limit=30");
      if (!res.ok) return;
      const data = (await res.json()) as { items: ColorItem[] };
      const loaded = data.items ?? [];
      setItems(loaded);
      try {
        sessionStorage.setItem(COLOR_CACHE_KEY, JSON.stringify(loaded));
      } catch {
        // storage full — ignore
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="color-page-shell">
      <LandingPageHeader />

      <div className="color-feed-wrap">
        {loading && <div className="color-empty">불러오는 중...</div>}
        {!loading && items.length === 0 && <div className="color-empty">등록된 컬러가 없습니다.</div>}

        {!loading && items.length > 0 && (
          <div className="color-grid">
            {items.map((item) => (
            <ColorCard
              key={item.id}
              item={item}
              onClick={() => router.push(`/color/${item.id}`)}
            />
          ))}
          </div>
        )}
      </div>

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
    </main>
  );
}
