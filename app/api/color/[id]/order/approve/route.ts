import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestKakaoApprove } from "@/lib/payments/kakao";
import { syncProfile } from "@/lib/profiles";

function getPartnerUserId(profileId: string) {
  return profileId;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let orderIdForError: string | null = null;

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = (await request.json()) as {
      orderId?: string;
      pgToken?: string;
    };

    const orderId = body.orderId?.trim();
    const pgToken = body.pgToken?.trim();
    orderIdForError = orderId ?? null;
    if (!orderId || !pgToken) {
      return NextResponse.json({ message: "결제 승인 정보가 부족합니다." }, { status: 400 });
    }

    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;
    const profile = await syncProfile({ email, fullName });

    if (!profile) {
      return NextResponse.json({ message: "프로필을 찾을 수 없습니다." }, { status: 404 });
    }

    const { id } = await params;
    void id;

    const admin = createSupabaseAdminClient();
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, user_id, status")
      .eq("id", orderId)
      .eq("user_id", profile.id)
      .single<{ id: string; user_id: string; status: string }>();

    if (orderError || !order) {
      return NextResponse.json({ message: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    if (order.status === "결제완료") {
      return NextResponse.json({ ok: true, orderId });
    }

    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .select("provider_payment_id")
      .eq("order_id", orderId)
      .single<{ provider_payment_id: string | null }>();

    if (paymentError || !payment?.provider_payment_id) {
      return NextResponse.json({ message: "결제 준비 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    await requestKakaoApprove({
      tid: payment.provider_payment_id,
      partnerOrderId: orderId,
      partnerUserId: getPartnerUserId(profile.id),
      pgToken,
    });

    await admin.from("orders").update({ status: "결제완료" }).eq("id", orderId);
    await admin
      .from("payments")
      .update({ status: "completed" })
      .eq("order_id", orderId);

    // tier 승격: 결제완료된 주문의 color.product_code로 판별
    try {
      const { data: orderItem } = await admin
        .from("order_items")
        .select("color_id")
        .eq("order_id", orderId)
        .maybeSingle<{ color_id: string | null }>();

      if (orderItem?.color_id) {
        const { data: color } = await admin
          .from("colors")
          .select("product_code")
          .eq("id", orderItem.color_id)
          .maybeSingle<{ product_code: string | null }>();

        const { data: currentProfile } = await admin
          .from("profiles")
          .select("tier")
          .eq("id", profile.id)
          .maybeSingle<{ tier: string | null }>();

        const isArao = color?.product_code === "arao";
        const currentTier = currentProfile?.tier ?? "general";

        let nextTier = currentTier;
        if (isArao) {
          nextTier = "premium";
        } else if (currentTier !== "premium") {
          nextTier = "pro";
        }

        if (nextTier !== currentTier) {
          await admin.from("profiles").update({ tier: nextTier }).eq("id", profile.id);
        }
      }
    } catch (tierError) {
      console.error("tier promotion error:", tierError);
    }

    return NextResponse.json({ ok: true, orderId });
  } catch (error) {
    console.error("POST /api/color/[id]/order/approve error:", error);

    if (orderIdForError) {
      const admin = createSupabaseAdminClient();
      await admin.from("orders").update({ status: "결제오류" }).eq("id", orderIdForError);
      await admin.from("payments").update({ status: "approve_failed" }).eq("order_id", orderIdForError);
    }

    const message = error instanceof Error ? error.message : "결제 승인에 실패했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
