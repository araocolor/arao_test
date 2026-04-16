"use client";

import { useState, useEffect, useRef, type TouchEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { ColorOrderHeader } from "@/components/order-header";
import { OrderFooter } from "@/components/order-footer";
import type { ColorItem } from "@/lib/color-types";

const COLOR_CACHE_KEY = "color-items";

const SLIDE_LABELS: Record<string, string> = {
  standard: "Standard",
  arao: "Arao",
  portrait: "Portrait",
};

function getFromCache(id: string): ColorItem | null {
  try {
    const raw = sessionStorage.getItem(COLOR_CACHE_KEY);
    if (!raw) return null;
    const items = JSON.parse(raw) as ColorItem[];
    return items.find((i) => i.id === id) ?? null;
  } catch {
    return null;
  }
}

type Slide = { key: string; src: string };

function buildSlides(item: ColorItem): Slide[] {
  const candidates: Slide[] = [
    { key: "standard", src: item.img_standard_full ?? item.img_standard_mid ?? item.img_standard_thumb ?? "" },
    { key: "arao",     src: item.img_arao_full     ?? item.img_arao_mid     ?? item.img_arao_thumb     ?? "" },
    { key: "portrait", src: item.img_portrait_full ?? item.img_portrait_mid ?? item.img_portrait_thumb ?? "" },
  ];
  return candidates.filter((s) => s.src !== "");
}

function ColorImageSlider({ item, isAdmin }: { item: ColorItem; isAdmin: boolean }) {
  const router = useRouter();
  const slides = buildSlides(item);
  const araoIdx = slides.findIndex((s) => s.key === "arao");
  const [currentIndex, setCurrentIndex] = useState(araoIdx >= 0 ? araoIdx : 0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const lastTouchXRef = useRef<number | null>(null);
  const lastTouchTimeRef = useRef<number | null>(null);
  const velocityXRef = useRef(0);
  const isDraggingRef = useRef(false);

  const goTo = (index: number) => setCurrentIndex(Math.max(0, Math.min(index, slides.length - 1)));
  const goPrev = () => goTo(currentIndex - 1);
  const goNext = () => goTo(currentIndex + 1);

  const onTouchStart = (e: TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    lastTouchXRef.current = e.touches[0].clientX;
    lastTouchTimeRef.current = Date.now();
    velocityXRef.current = 0;
    isDraggingRef.current = false;
    setIsDragging(false);
    setDragOffset(0);
  };

  const onTouchMove = (e: TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const dx = e.touches[0].clientX - touchStartXRef.current;
    const dy = e.touches[0].clientY - touchStartYRef.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
      isDraggingRef.current = true;
      setIsDragging(true);
    }
    if (isDraggingRef.current) {
      e.preventDefault();
      const atStart = currentIndex === 0 && dx > 0;
      const atEnd = currentIndex === slides.length - 1 && dx < 0;
      setDragOffset(atStart || atEnd ? dx * 0.35 : dx);
      const now = Date.now();
      if (lastTouchXRef.current !== null && lastTouchTimeRef.current !== null) {
        const dt = now - lastTouchTimeRef.current;
        if (dt > 0) velocityXRef.current = (e.touches[0].clientX - lastTouchXRef.current) / dt;
      }
      lastTouchXRef.current = e.touches[0].clientX;
      lastTouchTimeRef.current = now;
    }
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (!isDraggingRef.current || touchStartXRef.current === null) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      isDraggingRef.current = false;
      return;
    }
    const dx = e.changedTouches[0].clientX - touchStartXRef.current;
    const width = wrapRef.current?.clientWidth ?? 1;
    let nextIndex = currentIndex;
    if (Math.abs(dx) > width * 0.18 || Math.abs(velocityXRef.current) > 0.35) {
      nextIndex = dx < 0 ? currentIndex + 1 : currentIndex - 1;
    }
    setIsDragging(false);
    setDragOffset(0);
    goTo(nextIndex);
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isDraggingRef.current = false;
  };

  if (slides.length === 0) {
    return <div className="color-detail-image-wrap"><div className="color-card-image-placeholder">이미지 없음</div></div>;
  }

  return (
    <div
      ref={wrapRef}
      className="color-detail-image-wrap"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="gallery-hero-slider-track"
        style={{
          transform: `translate3d(calc(${-currentIndex * 100}% + ${dragOffset}px), 0, 0)`,
          transition: isDragging ? "none" : "transform 360ms cubic-bezier(0.22, 0.61, 0.36, 1)",
        }}
      >
        {slides.map((slide, i) => (
          <div key={slide.key} className="gallery-hero-slide">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.src}
              alt={SLIDE_LABELS[slide.key] ?? slide.key}
              className="color-detail-image"
              draggable={false}
              loading={i === 0 ? "eager" : "lazy"}
            />
          </div>
        ))}
      </div>

      {/* 슬라이드 라벨 */}
      <span className="gallery-before-btn">{SLIDE_LABELS[slides[currentIndex]?.key] ?? ""}</span>

      {/* 화살표 */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            className="gallery-slide-arrow gallery-slide-arrow-left"
            onClick={goPrev}
            disabled={currentIndex === 0}
            aria-label="이전 사진"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            className="gallery-slide-arrow gallery-slide-arrow-right"
            onClick={goNext}
            disabled={currentIndex === slides.length - 1}
            aria-label="다음 사진"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <div className="gallery-slide-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`gallery-slide-dot${i === currentIndex ? " gallery-slide-dot-active" : ""}`}
                onClick={() => goTo(i)}
                aria-label={`슬라이드 ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}

      {/* 수정 버튼 */}
      {isAdmin && (
        <button
          type="button"
          className="color-detail-edit-btn"
          onClick={() => router.push(`/color/write?id=${item.id}`)}
        >
          수정
        </button>
      )}
    </div>
  );
}

export default function ColorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<ColorItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const role = sessionStorage.getItem("user-role");
    setIsAdmin(role === "admin");
  }, []);

  useEffect(() => {
    const cached = getFromCache(id);
    if (cached) setItem(cached);

    void (async () => {
      try {
        const res = await fetch(`/api/color/${id}`);
        if (!res.ok) return;
        const data = (await res.json()) as ColorItem;
        setItem(data);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [id]);

  const hasPurchase = item !== null && item.price != null && item.price > 0;
  const hasDownload = item !== null && !hasPurchase && !!item.file_link;

  const handleBuy = () => {
    if (!item) return;
    if (hasPurchase) router.push(`/color/${item.id}/order`);
    else if (hasDownload) window.location.href = item.file_link!;
  };

  return (
    <main className="color-detail-shell">
      <ColorOrderHeader />

      {loading && <div className="color-empty">불러오는 중...</div>}

      {!loading && !item && (
        <div className="color-empty">
          <p>아이템을 찾을 수 없습니다.</p>
          <button className="color-detail-back-btn" onClick={() => router.back()}>
            돌아가기
          </button>
        </div>
      )}

      {!loading && item && (
        <div className="color-detail-grid">
          {/* 왼쪽: 정보 */}
          <div className="color-detail-info landing-stack-sm">
            <span className="landing-section-label">COLOR</span>
            <h1 className="color-detail-title">{item.title}</h1>
            {item.content && <p className="color-detail-body">{item.content}</p>}
            {item.price != null && (
              <p className="color-detail-price">{item.price.toLocaleString()}원</p>
            )}
          </div>

          {/* 오른쪽: 슬라이드 이미지 */}
          <ColorImageSlider item={item} isAdmin={isAdmin} />
        </div>
      )}

      {!loading && item && (
        <OrderFooter
          onBuy={handleBuy}
          buyDisabled={!hasPurchase && !hasDownload}
          buyLabel={hasPurchase ? "구매하기" : hasDownload ? "다운로드" : "가격 준비중"}
        />
      )}
    </main>
  );
}
