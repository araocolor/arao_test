"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { OrderDetail } from "@/lib/orders";
import { getCached, setCached } from "@/hooks/use-prefetch-cache";

const STATUS_STYLE: Record<string, { color: string; background: string }> = {
  결제완료: { color: "#1d4ed8", background: "#dbeafe" },
  발송완료: { color: "#15803d", background: "#dcfce7" },
  환불진행중: { color: "#854d0e", background: "#fef08a" },
  환불완료: { color: "#6b21a8", background: "#f3e8ff" },
  결제오류: { color: "#991b1b", background: "#fee2e2" },
  pending: { color: "#6b7280", background: "#f3f4f6" },
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState<string>("");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

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
        <button onClick={() => router.back()} style={{ marginTop: 16, padding: "8px 16px", cursor: "pointer" }}>돌아가기</button>
      </div>
    );
  if (!order)
    return (
      <div style={{ padding: 16 }}>
        주문을 찾을 수 없습니다.
        <button onClick={() => router.back()} style={{ marginTop: 16, padding: "8px 16px", cursor: "pointer" }}>돌아가기</button>
      </div>
    );

  const { status, total_amount, currency, payment, created_at, user_email } = order;
  const statusStyle = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  const items = order.items ?? [];

  return (
    <div className="account-panel-card stack account-section-card page-slide-down">

      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>주문 상세</h2>
        <button
          onClick={() => router.back()}
          style={{ padding: "8px 16px", background: "#3b82f6", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14 }}
        >
          돌아가기
        </button>
      </div>

      {/* 상품정보 */}
      {items.length > 0 && (
        <section style={{ marginTop: 20, paddingBottom: 20, borderBottom: "1px solid #e5e7eb" }}>
          <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16 }}>상품정보</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((item) => (
              <div key={item.id} style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{ width: 72, height: 72, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "#f3f4f6", position: "relative" }}>
                  {item.image_url ? (
                    <Image src={item.image_url} alt={item.product_name ?? "상품"} fill sizes="72px" style={{ objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#9ca3af" }}>없음</div>
                  )}
                </div>
                <div>
                  <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 15 }}>{item.product_name ?? "상품명 없음"}</p>
                  <p style={{ margin: 0, fontSize: 14, color: "#374151" }}>
                    {(item.unit_price ?? 0).toLocaleString("ko-KR")}원
                    {item.quantity > 1 && <span style={{ color: "#6b7280" }}> × {item.quantity}</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 주문정보 */}
      <section style={{ marginTop: 20, paddingBottom: 20, borderBottom: "1px solid #e5e7eb" }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16 }}>주문정보</h3>
        <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr" }}>
            <span style={{ fontWeight: 600 }}>주문번호</span>
            <span style={{ fontSize: 12, color: "#666", fontFamily: "monospace" }}>{order.id}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr" }}>
            <span style={{ fontWeight: 600 }}>주문일시</span>
            <span>{formatDateTime(created_at)}</span>
          </div>
          {user_email && (
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr" }}>
              <span style={{ fontWeight: 600 }}>구매자 이메일</span>
              <span>{user_email}</span>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr" }}>
            <span style={{ fontWeight: 600 }}>주문상태</span>
            <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 99, fontSize: 12, fontWeight: 700, width: "fit-content", color: statusStyle.color, background: statusStyle.background }}>
              {status}
            </span>
          </div>
        </div>
      </section>

      {/* 결제정보 */}
      <section style={{ marginTop: 20, paddingBottom: 20, borderBottom: "1px solid #e5e7eb" }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16 }}>결제정보</h3>
        <div style={{ display: "grid", gap: 8, fontSize: 14, padding: 12, background: "#f9fafb", borderRadius: 6 }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr" }}>
            <span style={{ fontWeight: 600 }}>결제수단</span>
            <span>{payment.provider || "미정"}</span>
          </div>
          {payment.provider_payment_id && (
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr" }}>
              <span style={{ fontWeight: 600 }}>거래번호</span>
              <span style={{ fontSize: 12, color: "#666", fontFamily: "monospace" }}>{payment.provider_payment_id}</span>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
            <span style={{ fontWeight: 600 }}>결제금액</span>
            <span style={{ fontWeight: 700 }}>{total_amount.toLocaleString("ko-KR")} {currency}</span>
          </div>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "#6b7280" }}>
          카카오페이 앱 &gt; 결제 내역에서 영수증을 확인하실 수 있습니다.
        </p>
      </section>

      {/* 상품 제공 안내 */}
      <section style={{ marginTop: 20, paddingBottom: 20, borderBottom: "1px solid #e5e7eb" }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16 }}>상품 제공 안내</h3>
        <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, background: "#f9fafb", padding: 12, borderRadius: 6 }}>
          <p style={{ margin: 0 }}>구매 완료 후 등록하신 이메일({user_email ?? "이메일"})로 상품이 발송됩니다. 미수신 시 스팸함을 확인하시거나 고객센터로 문의해 주세요.</p>
        </div>
      </section>

      {/* 환불 정책 */}
      <section style={{ marginTop: 20 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16 }}>환불 정책</h3>
        <div style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.7, background: "#fef9f0", border: "1px solid #fed7aa", padding: 12, borderRadius: 6 }}>
          <p style={{ margin: "0 0 6px", fontWeight: 600, color: "#92400e" }}>디지털 상품 환불 불가 안내</p>
          <p style={{ margin: 0 }}>
            본 상품은 디지털 콘텐츠로, 전자상거래법 제17조 제2항에 따라 구매 완료 후 청약철회(환불)가 불가합니다.
            단, 상품 하자 또는 오배송의 경우 고객센터를 통해 처리 가능합니다.
          </p>
        </div>
      </section>

    </div>
  );
}
