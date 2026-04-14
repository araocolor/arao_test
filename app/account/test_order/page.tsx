"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TestOrderResponse = {
  ok?: boolean;
  orderId?: string;
  amount?: number;
  currency?: string;
  provider?: string;
  message?: string;
};

export default function AccountTestOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TestOrderResponse | null>(null);

  async function handleTestPayment() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/account/test-order", {
        method: "POST",
      });
      const data = (await response.json()) as TestOrderResponse;

      if (!response.ok || !data?.ok || !data.orderId) {
        setError(data?.message ?? "임시 결제 테스트에 실패했습니다.");
        return;
      }

      setResult(data);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="account-panel-card stack account-section-card page-slide-down">
      <h2>test_order</h2>
      <p className="muted" style={{ margin: 0 }}>
        임시 결제 버튼으로 테스트 주문/결제 데이터를 생성합니다.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => void handleTestPayment()}
          disabled={loading}
          className="account-btn"
          style={{ minWidth: 140 }}
        >
          {loading ? "결제 테스트 중..." : "임시 결제 실행"}
        </button>

        {result?.orderId && (
          <button
            type="button"
            onClick={() => router.push(`/account/orders/${result.orderId}`)}
            className="account-btn"
            style={{ minWidth: 180 }}
          >
            생성된 주문 상세 보기
          </button>
        )}
      </div>

      {error && (
        <p style={{ margin: 0, color: "#dc2626", fontWeight: 600 }}>{error}</p>
      )}

      {result?.orderId && (
        <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7 }}>
          <p style={{ margin: 0 }}>
            주문 ID: <strong>{result.orderId}</strong>
          </p>
          <p style={{ margin: 0 }}>
            결제 금액: <strong>{result.amount?.toLocaleString("ko-KR") ?? 0}</strong> {result.currency ?? "KRW"}
          </p>
          <p style={{ margin: 0 }}>
            provider: <strong>{result.provider ?? "test-kakao-link"}</strong>
          </p>
        </div>
      )}
    </div>
  );
}
