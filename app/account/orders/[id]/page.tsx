"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderDetail } from "@/lib/orders";
import { getCached, setCached } from "@/hooks/use-prefetch-cache";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState<string>("");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve params
  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  // Fetch order
  useEffect(() => {
    if (!id) return;

    const fetchOrder = async () => {
      try {
        const cached = getCached<OrderDetail>(`order_${id}`);
        if (cached) {
          setOrder(cached);
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/account/orders/${id}`);
        if (!res.ok) throw new Error("Failed to fetch order");
        const data = await res.json();
        setCached(`order_${id}`, data);
        setOrder(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id]);

  if (loading) return <div style={{ padding: 16 }}>로딩 중...</div>;
  if (error)
    return (
      <div style={{ padding: 16, color: "#ef4444" }}>
        오류: {error}
        <button
          onClick={() => router.back()}
          style={{ marginTop: 16, padding: "8px 16px", cursor: "pointer" }}
        >
          돌아가기
        </button>
      </div>
    );
  if (!order)
    return (
      <div style={{ padding: 16 }}>
        주문을 찾을 수 없습니다.
        <button
          onClick={() => router.back()}
          style={{ marginTop: 16, padding: "8px 16px", cursor: "pointer" }}
        >
          돌아가기
        </button>
      </div>
    );

  const { user_id, status, total_amount, currency, payment, created_at, user_email, user_username } = order;

  return (
    <div className="admin-panel-card stack account-section-card page-slide-down">
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>주문 상세</h2>
        <button
          onClick={() => router.back()}
          style={{
            padding: "8px 16px",
            background: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          돌아가기
        </button>
      </div>

      {/* 주문 정보 */}
      <section style={{ marginTop: 20, paddingBottom: 20, borderBottom: "1px solid #e5e7eb" }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16 }}>주문정보</h3>
        <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr" }}>
            <span style={{ fontWeight: 600 }}>사용자 아이디</span>
            <span>
              {user_username && user_email ? `${user_username}, ${user_email}` : user_username || user_email || "미정"}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr" }}>
            <span style={{ fontWeight: 600 }}>주문일자</span>
            <span>{new Date(created_at).toLocaleDateString("ko-KR")}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr" }}>
            <span style={{ fontWeight: 600 }}>주문상태</span>
            <span
              style={{
                display: "inline-block",
                padding: "4px 12px",
                borderRadius: 4,
                background:
                  status === "결제완료"
                    ? "#dbeafe"
                    : status === "발송완료"
                      ? "#dcfce7"
                      : status === "환불진행중"
                        ? "#fef08a"
                        : status === "환불완료"
                          ? "#f3e8ff"
                          : "#fee2e2",
                color:
                  status === "결제완료"
                    ? "#0369a1"
                    : status === "발송완료"
                      ? "#15803d"
                      : status === "환불진행중"
                        ? "#854d0e"
                        : status === "환불완료"
                          ? "#6b21a8"
                          : "#991b1b",
                fontSize: 12,
                fontWeight: 600,
                width: "fit-content",
              }}
            >
              {status}
            </span>
          </div>
        </div>
      </section>

      {/* 가격 정보 */}
      <section style={{ marginTop: 20, paddingBottom: 20, borderBottom: "1px solid #e5e7eb" }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16 }}>결제금액</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "120px 1fr",
            gap: 8,
            padding: 12,
            background: "#f9fafb",
            borderRadius: 6,
            fontSize: 14,
          }}
        >
          <span style={{ fontWeight: 600 }}>금액</span>
          <span>
            {total_amount.toLocaleString("ko-KR")} {currency}
          </span>
        </div>
      </section>

      {/* 결제 정보 */}
      <section style={{ marginTop: 20 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16 }}>결제정보</h3>
        <div
          style={{
            display: "grid",
            gap: 8,
            fontSize: 14,
            padding: 12,
            background: "#f9fafb",
            borderRadius: 6,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr" }}>
            <span style={{ fontWeight: 600 }}>결제 제공사</span>
            <span>{payment.provider || "미정"}</span>
          </div>
          {payment.provider_payment_id && (
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr" }}>
              <span style={{ fontWeight: 600 }}>거래번호</span>
              <span style={{ fontSize: 12, color: "#666", fontFamily: "monospace" }}>
                {payment.provider_payment_id}
              </span>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr" }}>
            <span style={{ fontWeight: 600 }}>결제상태</span>
            <span
              style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: 3,
                background: payment.status === "completed" ? "#dbeafe" : "#fee2e2",
                color: payment.status === "completed" ? "#0369a1" : "#991b1b",
                fontSize: 12,
                fontWeight: 600,
                width: "fit-content",
              }}
            >
              {payment.status}
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr",
              borderTop: "1px solid #e5e7eb",
              paddingTop: 8,
            }}
          >
            <span style={{ fontWeight: 600 }}>결제금액</span>
            <span style={{ fontWeight: 700 }}>
              {payment.amount.toLocaleString("ko-KR")} {payment.currency}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
