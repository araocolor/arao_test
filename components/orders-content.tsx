"use client";

import Link from "next/link";
import Image from "next/image";
import type { Order } from "@/lib/orders";

type OrdersContentProps = {
  orders: Order[];
  openOrderId?: string;
};

const STATUS_STYLE: Record<string, { color: string; background: string }> = {
  결제완료: { color: "#1d4ed8", background: "#eff6ff" },
  발송완료: { color: "#15803d", background: "#f0fdf4" },
  환불진행중: { color: "#b45309", background: "#fffbeb" },
  환불완료: { color: "#7e22ce", background: "#faf5ff" },
  결제오류: { color: "#b91c1c", background: "#fef2f2" },
  pending: { color: "#6b7280", background: "#f9fafb" },
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
  const time = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

export function OrdersContent({ orders, openOrderId }: OrdersContentProps) {
  return (
    <div className="account-panel-card stack account-section-card" data-testid="account-orders-v2">
      <h2>주문내역</h2>

      <p style={{ margin: 0, fontWeight: 700 }}>
        {orders.length > 0 ? `주문 ${orders.length}건` : "주문 내역이 없습니다"}
      </p>

      {orders.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {orders.map((order) => {
            const isFocused = openOrderId === order.id;
            const statusStyle = STATUS_STYLE[order.status] ?? STATUS_STYLE.pending;
            const items = order.items ?? [];

            return (
              <Link
                key={order.id}
                href={`/account/orders/${order.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
                prefetch={true}
              >
                <article
                  style={{
                    border: isFocused ? "1.5px solid #111111" : "1px solid #e5e7eb",
                    borderRadius: 12,
                    background: isFocused ? "#f4f4f5" : "#fff",
                    cursor: "pointer",
                    overflow: "hidden",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "#f9f9f9";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = isFocused ? "#f4f4f5" : "#fff";
                  }}
                >
                  {items.length === 0 ? (
                    <div style={{ padding: 16 }}>
                      <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>상품 정보 없음</p>
                    </div>
                  ) : (
                    items.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          padding: "14px 16px",
                          borderBottom: items.length > 1 ? "1px solid #f3f4f6" : undefined,
                        }}
                      >
                        {/* 좌측: 이미지 */}
                        <div
                          style={{
                            width: 72,
                            height: 72,
                            borderRadius: 8,
                            overflow: "hidden",
                            flexShrink: 0,
                            background: "#f3f4f6",
                            position: "relative",
                          }}
                        >
                          {item.image_url ? (
                            <Image
                              src={item.image_url}
                              alt={item.product_name ?? "상품 이미지"}
                              fill
                              sizes="72px"
                              style={{ objectFit: "cover" }}
                            />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#9ca3af" }}>
                              없음
                            </div>
                          )}
                        </div>

                        {/* 우측: 정보 */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.product_name ?? "상품명 없음"}
                          </p>
                          <p style={{ margin: "0 0 6px", fontSize: 13, color: "#374151" }}>
                            {(item.unit_price ?? 0).toLocaleString("ko-KR")}원
                            {item.quantity > 1 && <span style={{ color: "#6b7280" }}> × {item.quantity}</span>}
                          </p>
                          <p style={{ margin: "0 0 6px", fontSize: 12, color: "#6b7280" }}>
                            {formatDateTime(order.created_at)}
                          </p>
                          <span
                            style={{
                              display: "inline-block",
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 99,
                              color: statusStyle.color,
                              background: statusStyle.background,
                            }}
                          >
                            {order.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </article>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
