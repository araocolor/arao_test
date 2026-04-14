"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { LandingPageHeader } from "@/components/landing-page-header";
import Image from "next/image";

const COLOR_CACHE_KEY = "color-items";

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

// thumb으로 먼저 표시 후, 페이지 로드 완료 시 mid로 백그라운드 교체
function ColorCard({ item, onClick }: { item: ColorItem; onClick: () => void }) {
  const thumb = item.img_arao_thumb ?? item.img_arao_mid ?? item.img_arao_full;
  const mid = item.img_arao_full ?? item.img_arao_mid;
  const [src, setSrc] = useState(thumb);
  const upgradedRef = useRef(false);

  useEffect(() => {
    if (upgradedRef.current || !mid || mid === thumb) return;
    upgradedRef.current = true;
    const img = new window.Image();
    img.onload = () => setSrc(mid);
    img.src = mid;
  }, [mid, thumb]);

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

export default function ColorPage() {
  const router = useRouter();
  const [items, setItems] = useState<ColorItem[]>([]);
  const [loading, setLoading] = useState(true);

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
