import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";

// Types
export type Product = {
  id: string;
  name: string;
  price: number;
  currency: string;
  active: boolean;
  created_at: string;
};

export type Order = {
  id: string;
  user_id: string;
  status: "pending" | "결제완료" | "발송완료" | "환불진행중" | "환불완료" | "결제오류";
  total_amount: number;
  currency: string;
  payment_provider: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  order_id: string;
  provider: string;
  provider_payment_id: string | null;
  status: string;
  amount: number;
  currency: string;
  created_at: string;
};

export type OrderDetail = Order & {
  payment: Payment;
  user_email?: string;
  user_username?: string;
};

// DB Functions
export async function getOrdersByUser(
  userId: string,
  page: number = 1,
  limit: number = 10
): Promise<Order[]> {
  const supabase = await createSupabaseServerClient();

  const offset = (page - 1) * limit;

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data || [];
}

export async function getOrderById(id: string, userId: string): Promise<OrderDetail | null> {
  const supabase = await createSupabaseServerClient();

  // 1. Get order + verify ownership
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (orderError || !order) return null;

  // 2. Get payment details
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("*")
    .eq("order_id", id)
    .single();

  if (paymentError) return null;

  // 3. Get user info (username, email)
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, email")
    .eq("id", order.user_id)
    .single();

  return {
    ...order,
    payment,
    user_email: profile?.email,
    user_username: profile?.username,
  };
}

export async function getOrderByIdAdmin(id: string): Promise<OrderDetail | null> {
  const admin = createSupabaseAdminClient();

  // 1. Get order
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (orderError || !order) return null;

  // 2. Get payment
  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .select("*")
    .eq("order_id", id)
    .single();

  if (paymentError) return null;

  return {
    ...order,
    payment,
  };
}

export async function createOrder(
  userId: string,
  totalAmount: number,
  currency: string = "KRW",
  paymentProvider: string | null = null,
  status: string = "결제완료"
): Promise<Order | null> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin.from("orders").insert({
    user_id: userId,
    total_amount: totalAmount,
    currency,
    payment_provider: paymentProvider,
    status,
  });

  if (error) throw error;

  const order = (data?.[0] as unknown as Order) || null;

  // 주문 생성 시 알림 생성 (status = "결제완료"인 경우)
  if (order && status === "결제완료") {
    await createNotification(
      userId,
      "order_shipped",
      "상품이 최종결제되어 발송되었습니다.",
      `/account/orders/${order.id}`,
      order.id
    );
  }

  return order;
}

export async function updateOrderStatus(id: string, status: string): Promise<Order | null> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("orders")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  const order = data || null;

  // 상태 변경 시 알림 생성
  if (order) {
    if (status === "발송완료") {
      await createNotification(
        order.user_id,
        "order_shipped",
        "상품이 최종결제되어 발송되었습니다",
        `/account/orders/${id}`,
        id
      );
    } else if (status === "결제오류") {
      await createNotification(
        order.user_id,
        "order_cancelled",
        "카드결제가 취소되었습니다. 재결제를 진행해주세요",
        `/account/orders/${id}`,
        id
      );
    }
  }

  return order;
}
