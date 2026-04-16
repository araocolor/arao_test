"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { LandingPageHeader } from "@/components/landing-page-header";
import { markPurchasedColorId } from "@/lib/color-purchase-cache";

export default function ColorOrderSuccessPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pgToken = searchParams.get("pg_token");
  const orderId = searchParams.get("orderId");
  const approvedRef = useRef(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function clearRedirectTimer() {
    if (!redirectTimerRef.current) return;
    clearTimeout(redirectTimerRef.current);
    redirectTimerRef.current = null;
  }

  function moveToProduct() {
    clearRedirectTimer();
    router.replace(`/color/${id}`);
  }

  function getOrderDetailHref() {
    if (!orderId) return "/account/orders";
    return `/account/orders/${orderId}?fromColorId=${id}`;
  }

  function moveToOrderDetail() {
    clearRedirectTimer();
    router.push(getOrderDetailHref());
  }

  useEffect(() => {
    if (approvedRef.current || !pgToken || !orderId) {
      return;
    }

    approvedRef.current = true;

    void (async () => {
      try {
        const response = await fetch(`/api/color/${id}/order/approve`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ orderId, pgToken }),
        });
        const data = (await response.json()) as { ok?: boolean; message?: string };

        if (!response.ok || !data.ok) {
          throw new Error(data.message ?? "결제 승인에 실패했습니다.");
        }

        markPurchasedColorId(id);
        setApproved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "결제 승인에 실패했습니다.");
      }
    })();
  }, [id, orderId, pgToken, router]);

  useEffect(() => {
    if (!approved || error) return;
    clearRedirectTimer();
    redirectTimerRef.current = setTimeout(() => {
      router.replace(getOrderDetailHref());
    }, 1500);

    return () => {
      clearRedirectTimer();
    };
  }, [approved, error, id, orderId, router]);

  useEffect(() => {
    if (!error) return;
    clearRedirectTimer();
    redirectTimerRef.current = setTimeout(() => {
      if (orderId) {
        router.replace(`/account/orders?open=${orderId}`);
        return;
      }
      router.replace("/account/orders");
    }, 1500);

    return () => {
      clearRedirectTimer();
    };
  }, [error, orderId, router]);

  useEffect(() => {
    return () => {
      clearRedirectTimer();
    };
  }, []);

  return (
    <main className="color-detail-shell">
      <LandingPageHeader />
      <div className="color-order-state">
        {!error && !approved ? (
          <>
            <h1 className="color-detail-title">결제를 확인하고 있습니다</h1>
            <p className="color-order-copy">잠시만 기다려 주세요. 승인 완료 후 안내 화면이 표시됩니다.</p>
          </>
        ) : null}

        {!error && approved ? (
          <section className="color-order-success-card">
            <div className="color-order-success-check" aria-hidden="true">✓</div>
            <h1 className="color-order-success-title">결제완료 성공 !!! 😉</h1>
            <p className="color-order-copy">결제가 정상 처리되었습니다. 잠시 후 자동으로 이동합니다.</p>
            {orderId && (
              <p className="color-order-success-order">
                주문번호 <strong>{orderId}</strong>
              </p>
            )}
            <div className="color-order-actions">
              <button
                type="button"
                className="landing-button landing-button-primary color-order-pay-btn"
                onClick={moveToOrderDetail}
                disabled={!orderId}
              >
                결제 상세 보기
              </button>
              <button
                type="button"
                className="color-order-secondary-btn"
                onClick={moveToProduct}
              >
                계속 둘러보기
              </button>
            </div>
          </section>
        ) : (
          error && (
            <section className="color-order-success-card color-order-fail-card">
              <div className="color-order-fail-check" aria-hidden="true">!</div>
              <h1 className="color-order-success-title color-order-fail-title">결제 확인에 실패했습니다</h1>
              <p className="color-order-error">{error}</p>
              <div className="color-order-actions">
                {orderId && (
                  <button
                    type="button"
                    className="landing-button landing-button-primary color-order-pay-btn"
                    onClick={() => router.push(`/account/orders/${orderId}`)}
                  >
                    결제상태보기
                  </button>
                )}
              </div>
            </section>
          )
        )}
      </div>
    </main>
  );
}
