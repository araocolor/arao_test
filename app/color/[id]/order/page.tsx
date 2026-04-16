"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { ColorOrderHeader } from "@/components/order-header";
import { OrderFooter } from "@/components/order-footer";
import type { ColorItem } from "@/lib/color-types";

export default function ColorOrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<ColorItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionKey = `order-agree-${id}`;
  const allAgreeInputId = `order-agree-all-${id}`;
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedPurchase, setAgreedPurchase] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(sessionKey);
      if (saved) {
        const { terms, privacy, purchase } = JSON.parse(saved) as {
          terms: boolean;
          privacy: boolean;
          purchase: boolean;
        };
        setAgreedTerms(terms);
        setAgreedPrivacy(privacy);
        setAgreedPurchase(purchase);
      }
    } catch {}
  }, [sessionKey]);

  useEffect(() => {
    function handlePopState() {
      try {
        if (sessionStorage.getItem(sessionKey) !== null) {
          sessionStorage.removeItem(sessionKey);
        }
      } catch {}
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [sessionKey]);

  const allAgreed = agreedTerms && agreedPrivacy && agreedPurchase;

  // 약관 시트
  const [termsSheetOpen, setTermsSheetOpen] = useState(false);
  const termsSheetRef = useRef<HTMLDivElement>(null);
  const termsTouchStartY = useRef(0);
  const termsDragY = useRef(0);

  // 개인정보 시트
  const [privacySheetOpen, setPrivacySheetOpen] = useState(false);
  const privacySheetRef = useRef<HTMLDivElement>(null);
  const privacyTouchStartY = useRef(0);
  const privacyDragY = useRef(0);

  // 결제 확인 시트
  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const paySheetRef = useRef<HTMLDivElement>(null);
  const payTouchStartY = useRef(0);
  const payDragY = useRef(0);

  const DISCOUNT_RATE = 0.2;
  const basePrice = (item?.price ?? 0) * qty;
  const discountAmount = Math.round(basePrice * DISCOUNT_RATE);
  const finalPrice = basePrice - discountAmount;

  function saveAgree(terms: boolean, privacy: boolean, purchase: boolean) {
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify({ terms, privacy, purchase }));
    } catch {}
  }

  function clearAgreeCache() {
    try {
      if (sessionStorage.getItem(sessionKey) !== null) {
        sessionStorage.removeItem(sessionKey);
      }
    } catch {}
  }

  function handleBackWithCacheClear() {
    clearAgreeCache();
    router.back();
  }

  function openTermsSheet() {
    setPaySheetOpen(false);
    setPrivacySheetOpen(false);
    setTermsSheetOpen(true);
  }

  function closeTermsSheet() {
    setTermsSheetOpen(false);
  }

  function handleTermsSheetTouchStart(e: React.TouchEvent) {
    termsTouchStartY.current = e.touches[0].clientY;
    termsDragY.current = 0;
  }

  function handleTermsSheetTouchMove(e: React.TouchEvent) {
    const delta = e.touches[0].clientY - termsTouchStartY.current;
    if (delta < 0) return;
    termsDragY.current = delta;
    if (termsSheetRef.current) {
      termsSheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  }

  function handleTermsSheetTouchEnd() {
    if (termsDragY.current > 60) {
      closeTermsSheet();
    } else if (termsSheetRef.current) {
      termsSheetRef.current.style.transform = "";
    }
    termsDragY.current = 0;
  }

  function openPrivacySheet() {
    setPaySheetOpen(false);
    setTermsSheetOpen(false);
    setPrivacySheetOpen(true);
  }

  function closePrivacySheet() {
    setPrivacySheetOpen(false);
  }

  function handlePrivacySheetTouchStart(e: React.TouchEvent) {
    privacyTouchStartY.current = e.touches[0].clientY;
    privacyDragY.current = 0;
  }

  function handlePrivacySheetTouchMove(e: React.TouchEvent) {
    const delta = e.touches[0].clientY - privacyTouchStartY.current;
    if (delta < 0) return;
    privacyDragY.current = delta;
    if (privacySheetRef.current) {
      privacySheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  }

  function handlePrivacySheetTouchEnd() {
    if (privacyDragY.current > 60) {
      closePrivacySheet();
    } else if (privacySheetRef.current) {
      privacySheetRef.current.style.transform = "";
    }
    privacyDragY.current = 0;
  }

  function openPaySheet() {
    setTermsSheetOpen(false);
    setPrivacySheetOpen(false);
    setPaySheetOpen(true);
  }

  function closePaySheet() {
    setPaySheetOpen(false);
  }

  function handlePaySheetTouchStart(e: React.TouchEvent) {
    payTouchStartY.current = e.touches[0].clientY;
    payDragY.current = 0;
  }

  function handlePaySheetTouchMove(e: React.TouchEvent) {
    const delta = e.touches[0].clientY - payTouchStartY.current;
    if (delta < 0) return;
    payDragY.current = delta;
    if (paySheetRef.current) {
      paySheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  }

  function handlePaySheetTouchEnd() {
    if (payDragY.current > 60) {
      closePaySheet();
    } else if (paySheetRef.current) {
      paySheetRef.current.style.transform = "";
    }
    payDragY.current = 0;
  }

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const response = await fetch(`/api/color/${id}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("상품 정보를 불러오지 못했습니다.");
        }

        const data = (await response.json()) as ColorItem;
        if (active) {
          setItem(data);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "상품 정보를 불러오지 못했습니다.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [id]);

  const imageSrc = useMemo(
    () => item?.img_arao_full ?? item?.img_arao_mid ?? item?.img_arao_thumb ?? null,
    [item]
  );

  async function handleStartPayment() {
    if (!item || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/color/${id}/order/ready`, {
        method: "POST",
      });
      const data = (await response.json()) as {
        ok?: boolean;
        redirectUrl?: string;
        message?: string;
      };

      if (response.status === 401) {
        router.push("/sign-in");
        return;
      }

      if (!response.ok || !data.ok || !data.redirectUrl) {
        throw new Error(data.message ?? "결제 준비에 실패했습니다.");
      }

      window.location.href = data.redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "결제 준비에 실패했습니다.");
      setSubmitting(false);
    }
  }

  return (
    <main className="color-detail-shell">
      <ColorOrderHeader onBack={handleBackWithCacheClear} />
      <div className="color-order-shell">
        {loading && <div className="color-empty">주문 정보를 불러오는 중...</div>}

        {!loading && error && !item && (
          <div className="color-order-state">
            <p>{error}</p>
            <button type="button" className="color-detail-back-btn" onClick={handleBackWithCacheClear}>
              돌아가기
            </button>
          </div>
        )}

        {!loading && item && (
          <section className="color-order-grid">
            <div className="color-order-preview">
              <div className="color-order-image-wrap">
                {imageSrc ? (
                  <Image
                    src={imageSrc}
                    alt={item.title}
                    fill
                    className="color-detail-image"
                    sizes="(max-width: 820px) 100vw, 40vw"
                    priority
                  />
                ) : (
                  <div className="color-card-image-placeholder">이미지 없음</div>
                )}
              </div>
              {item.content && <p className="color-detail-body">{item.content}</p>}
            </div>

            <div className="color-order-summary">
              <span className="landing-section-label">ORDER</span>
              <h1 className="color-detail-title">주문 확인</h1>
              <p className="color-order-copy">
                상품과 금액을 확인한 뒤 카카오페이 테스트 결제로 이동합니다.
              </p>

              <div className="color-order-card">
                <div className="color-order-card-row">
                  <span>상품명</span>
                  <strong>{item.title}</strong>
                </div>
                <div className="color-order-card-row">
                  <span>제공 방식</span>
                  <strong>구매 즉시 디지털 제공</strong>
                </div>
                <div className="color-order-card-row">
                  <span>결제수단</span>
                  <strong>카카오페이</strong>
                </div>
                <div className="color-order-card-row">
                  <span>결제금액</span>
                  <strong>{(item.price ?? 0).toLocaleString("ko-KR")}원</strong>
                </div>
              </div>

              <p className="color-order-refund-notice">
                디지털 상품 특성상 구매 완료 후 환불이 불가합니다.
              </p>

              <div className="color-order-agree-list">
                <div className="color-order-agree-row color-order-agree-all">
                  <input
                    id={allAgreeInputId}
                    type="checkbox"
                    checked={allAgreed}
                    onChange={(e) => {
                      setAgreedTerms(e.target.checked);
                      setAgreedPrivacy(e.target.checked);
                      setAgreedPurchase(e.target.checked);
                      saveAgree(e.target.checked, e.target.checked, e.target.checked);
                    }}
                  />
                  <label htmlFor={allAgreeInputId}>필수항목 전체동의</label>
                </div>
                <hr className="color-order-agree-divider" />
                <div className="color-order-agree-row">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => { setAgreedTerms(e.target.checked); saveAgree(e.target.checked, agreedPrivacy, agreedPurchase); }}
                  />
                  <button type="button" className="color-order-agree-link" onClick={openTermsSheet}>이용약관 동의 (필수)</button>
                </div>
                <div className="color-order-agree-row">
                  <input
                    type="checkbox"
                    checked={agreedPrivacy}
                    onChange={(e) => { setAgreedPrivacy(e.target.checked); saveAgree(agreedTerms, e.target.checked, agreedPurchase); }}
                  />
                  <button type="button" className="color-order-agree-link" onClick={openPrivacySheet}>개인정보 수집·이용 동의 (필수)</button>
                </div>
                <div className="color-order-agree-row">
                  <input
                    type="checkbox"
                    checked={agreedPurchase}
                    onChange={(e) => { setAgreedPurchase(e.target.checked); saveAgree(agreedTerms, agreedPrivacy, e.target.checked); }}
                  />
                  <span>구매조건 확인 및 결제 진행 동의 (필수)</span>
                </div>
              </div>

              {error && <p className="color-order-error">{error}</p>}
            </div>
          </section>
        )}
      </div>
      <OrderFooter
        buyDisabled={!item || item.price == null || item.price <= 0 || !allAgreed}
        buyLabel="구매하기"
        onBuy={openPaySheet}
      />

      {termsSheetOpen && (
        <div className="order-sheet-backdrop order-sheet-backdrop--terms" onClick={closeTermsSheet} aria-hidden="true" />
      )}
      <div
        ref={termsSheetRef}
        className={`order-sheet${termsSheetOpen ? " is-open" : ""}`}
        onTouchStart={handleTermsSheetTouchStart}
        onTouchMove={handleTermsSheetTouchMove}
        onTouchEnd={handleTermsSheetTouchEnd}
      >
        <button
          type="button"
          className="sheet-close-btn"
          aria-label="이용약관 닫기"
          onClick={closeTermsSheet}
        >
          ×
        </button>
        <div className="order-sheet-handle order-sheet-handle--terms" aria-hidden="true" />
        <iframe
          src="/terms.html"
          className="order-sheet-iframe"
          title="이용약관"
        />
      </div>

      {privacySheetOpen && (
        <div className="order-sheet-backdrop order-sheet-backdrop--terms" onClick={closePrivacySheet} aria-hidden="true" />
      )}
      <div
        ref={privacySheetRef}
        className={`order-sheet${privacySheetOpen ? " is-open" : ""}`}
        onTouchStart={handlePrivacySheetTouchStart}
        onTouchMove={handlePrivacySheetTouchMove}
        onTouchEnd={handlePrivacySheetTouchEnd}
      >
        <button
          type="button"
          className="sheet-close-btn"
          aria-label="개인정보 닫기"
          onClick={closePrivacySheet}
        >
          ×
        </button>
        <div className="order-sheet-handle order-sheet-handle--terms" aria-hidden="true" />
        <iframe
          src="/privacy.html"
          className="order-sheet-iframe"
          title="개인정보 수집·이용"
        />
      </div>

      {/* 결제 확인 바텀시트 */}
      {paySheetOpen && (
        <div className="order-sheet-backdrop" onClick={closePaySheet} aria-hidden="true" />
      )}
      <div
        ref={paySheetRef}
        className={`pay-sheet${paySheetOpen ? " is-open" : ""}`}
        onTouchStart={handlePaySheetTouchStart}
        onTouchMove={handlePaySheetTouchMove}
        onTouchEnd={handlePaySheetTouchEnd}
      >
        <div className="order-sheet-handle" />

        {/* 상단: 옵션 */}
        <div className="pay-sheet-option">
          <p className="pay-sheet-product-name">{item?.title ?? ""}</p>
          <div className="pay-sheet-qty-row">
            <span className="pay-sheet-qty-label">수량</span>
            <div className="pay-sheet-qty-ctrl">
              <button
                type="button"
                className="pay-sheet-qty-btn"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="수량 감소"
              >−</button>
              <span className="pay-sheet-qty-val">{qty}</span>
              <button
                type="button"
                className="pay-sheet-qty-btn"
                onClick={() => setQty((q) => q + 1)}
                aria-label="수량 증가"
              >+</button>
            </div>
          </div>
        </div>

        <hr className="pay-sheet-divider" />

        {/* 하단: 가격 */}
        <div className="pay-sheet-price-area">
          <div className="pay-sheet-price-row">
            <span>회원 최초가입 할인</span>
            <span className="pay-sheet-discount">−{discountAmount.toLocaleString("ko-KR")}원 (20%)</span>
          </div>
          <div className="pay-sheet-price-row pay-sheet-total">
            <span>최종 결제금액</span>
            <strong>{finalPrice.toLocaleString("ko-KR")}원</strong>
          </div>
        </div>

        <button
          type="button"
          className="pay-sheet-buy-btn"
          disabled={submitting}
          onClick={() => void handleStartPayment()}
        >
          {submitting ? "결제 연결 중..." : "구매하기"}
        </button>

        {error && <p className="color-order-error" style={{ marginTop: 8 }}>{error}</p>}
      </div>
    </main>
  );
}
