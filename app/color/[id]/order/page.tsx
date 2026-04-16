"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedPurchase, setAgreedPurchase] = useState(false);

  const allAgreed = agreedTerms && agreedPrivacy && agreedPurchase;

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
      <ColorOrderHeader />
      <div className="color-order-shell">
        {loading && <div className="color-empty">주문 정보를 불러오는 중...</div>}

        {!loading && error && !item && (
          <div className="color-order-state">
            <p>{error}</p>
            <button type="button" className="color-detail-back-btn" onClick={() => router.back()}>
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
                <label className="color-order-agree-row color-order-agree-all">
                  <input
                    type="checkbox"
                    checked={allAgreed}
                    onChange={(e) => {
                      setAgreedTerms(e.target.checked);
                      setAgreedPrivacy(e.target.checked);
                      setAgreedPurchase(e.target.checked);
                    }}
                  />
                  <span>필수 항목 전체 동의</span>
                </label>
                <hr className="color-order-agree-divider" />
                <label className="color-order-agree-row">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                  />
                  <span><a href="/terms" target="_blank" className="color-order-agree-link">이용약관</a> 동의 (필수)</span>
                </label>
                <label className="color-order-agree-row">
                  <input
                    type="checkbox"
                    checked={agreedPrivacy}
                    onChange={(e) => setAgreedPrivacy(e.target.checked)}
                  />
                  <span><a href="/privacy" target="_blank" className="color-order-agree-link">개인정보 수집·이용</a> 동의 (필수)</span>
                </label>
                <label className="color-order-agree-row">
                  <input
                    type="checkbox"
                    checked={agreedPurchase}
                    onChange={(e) => setAgreedPurchase(e.target.checked)}
                  />
                  <span>구매조건 확인 및 결제 진행 동의 (필수)</span>
                </label>
              </div>

              {error && <p className="color-order-error">{error}</p>}
            </div>
          </section>
        )}
      </div>
      <OrderFooter
        buyDisabled={submitting || !item || item.price == null || item.price <= 0 || !allAgreed}
        buyLabel={submitting ? "결제 연결 중..." : "구매하기"}
        onBuy={() => void handleStartPayment()}
      />
    </main>
  );
}
