import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { syncProfile } from "@/lib/profiles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const TEST_PAYMENT_PROVIDER = "test-kakao-link";
const TEST_PAYMENT_AMOUNT = 1000;
const TEST_CURRENCY = "KRW";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    }

    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;
    const profile = await syncProfile({ email, fullName });

    if (!profile) {
      return NextResponse.json({ message: "프로필을 찾을 수 없습니다." }, { status: 404 });
    }

    const admin = createSupabaseAdminClient();

    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        user_id: profile.id,
        status: "결제완료",
        total_amount: TEST_PAYMENT_AMOUNT,
        currency: TEST_CURRENCY,
        payment_provider: TEST_PAYMENT_PROVIDER,
      })
      .select("id, status, total_amount, currency, created_at")
      .single();

    if (orderError || !order) {
      return NextResponse.json({ message: "임시 주문 생성 실패" }, { status: 500 });
    }

    const providerPaymentId = `test_${Date.now()}`;
    const { error: paymentError } = await admin.from("payments").insert({
      order_id: order.id,
      provider: TEST_PAYMENT_PROVIDER,
      provider_payment_id: providerPaymentId,
      status: "completed",
      amount: TEST_PAYMENT_AMOUNT,
      currency: TEST_CURRENCY,
    });

    if (paymentError) {
      await admin.from("orders").delete().eq("id", order.id);
      return NextResponse.json({ message: "임시 결제 생성 실패" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      amount: TEST_PAYMENT_AMOUNT,
      currency: TEST_CURRENCY,
      provider: TEST_PAYMENT_PROVIDER,
    });
  } catch (error) {
    console.error("POST /api/account/test-order error:", error);
    return NextResponse.json({ message: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
