import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getColorById } from "@/lib/colors";
import { requestKakaoReady } from "@/lib/payments/kakao";
import { syncProfile } from "@/lib/profiles";

function getAppUrl(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

function getPartnerUserId(profileId: string) {
  return profileId;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const item = await getColorById(id);

    if (!item) {
      return NextResponse.json({ message: "상품을 찾을 수 없습니다." }, { status: 404 });
    }

    const totalAmount = Number(item.price ?? 0);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return NextResponse.json({ message: "결제 가능한 가격이 없습니다." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        user_id: profile.id,
        status: "pending",
        total_amount: totalAmount,
        currency: "KRW",
        payment_provider: "kakao-link-test",
      })
      .select("id")
      .single<{ id: string }>();

    if (orderError || !order) {
      return NextResponse.json({ message: "주문 생성에 실패했습니다." }, { status: 500 });
    }

    const { error: paymentInsertError } = await admin.from("payments").insert({
      order_id: order.id,
      provider: "kakao-link-test",
      status: "ready",
      amount: totalAmount,
      currency: "KRW",
    });

    if (paymentInsertError) {
      await admin.from("orders").delete().eq("id", order.id);
      return NextResponse.json({ message: "결제 준비 저장에 실패했습니다." }, { status: 500 });
    }

    await admin.from("order_items").insert({
      order_id: order.id,
      color_id: id,
      product_name: item.title,
      unit_price: totalAmount,
      quantity: 1,
      image_url: item.img_arao_thumb ?? item.img_arao_mid ?? item.img_arao_full ?? null,
    });

    try {
      const appUrl = getAppUrl(request);
      const ready = await requestKakaoReady({
        partnerOrderId: order.id,
        partnerUserId: getPartnerUserId(profile.id),
        itemName: item.title,
        totalAmount,
        approvalUrl: `${appUrl}/color/${id}/order/success?orderId=${order.id}`,
        cancelUrl: `${appUrl}/color/${id}/order/cancel?orderId=${order.id}`,
        failUrl: `${appUrl}/color/${id}/order/fail?orderId=${order.id}`,
      });

      await admin
        .from("payments")
        .update({
          provider_payment_id: ready.tid,
          status: "redirect_ready",
        })
        .eq("order_id", order.id);

      const userAgent = request.headers.get("user-agent") ?? "";
      const prefersMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
      const redirectUrl = prefersMobile
        ? ready.next_redirect_mobile_url ?? ready.next_redirect_pc_url ?? ready.next_redirect_app_url
        : ready.next_redirect_pc_url ?? ready.next_redirect_mobile_url ?? ready.next_redirect_app_url;

      if (!redirectUrl) {
        throw new Error("카카오 결제 이동 주소를 받지 못했습니다.");
      }

      return NextResponse.json({
        ok: true,
        orderId: order.id,
        redirectUrl,
      });
    } catch (error) {
      await admin.from("orders").update({ status: "결제오류" }).eq("id", order.id);
      await admin
        .from("payments")
        .update({ status: "ready_failed" })
        .eq("order_id", order.id);

      const message = error instanceof Error ? error.message : "카카오 결제 준비에 실패했습니다.";
      return NextResponse.json({ message }, { status: 500 });
    }
  } catch (error) {
    console.error("POST /api/color/[id]/order/ready error:", error);
    return NextResponse.json({ message: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
