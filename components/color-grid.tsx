"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { ColorItem } from "@/lib/color-types";

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

  return (
    <>
      <div className="color-grid">
        {items.map((item) => (
          <ColorCard key={item.id} item={item} onClick={() => handleClick(item)} />
        ))}
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
    </>
  );
}
