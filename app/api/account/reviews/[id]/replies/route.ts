import { auth, currentUser } from "@clerk/nextjs/server";
import { createReviewReply, getReviewById } from "@/lib/reviews";
import { createNotification } from "@/lib/notifications";
import { syncProfile } from "@/lib/profiles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    if (!user?.emailAddresses?.[0]?.emailAddress) {
      return NextResponse.json({ error: "User info not found" }, { status: 400 });
    }

    const profile = await syncProfile({
      email: user.emailAddresses[0].emailAddress,
      fullName: user.fullName,
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 400 });
    }

    const { id } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    // 리뷰 존재 확인 + 원글 작성자 조회
    const result = await getReviewById(id);
    if (!result) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const { review } = result;

    // 답글 작성
    const reply = await createReviewReply(id, profile.id, content);

    if (!reply) {
      return NextResponse.json({ error: "Failed to create reply" }, { status: 500 });
    }

    // 원글 작성자에게 알림 생성 (본인이 아닌 경우)
    if (review.profile_id !== profile.id) {
      await createNotification(
        review.profile_id,
        "review_reply",
        `${profile.username || "사용자"}님이 작성한 댓글에 새로운 글 확인`,
        `/account/reviews/${id}`,
        id,
        profile.icon_image ?? null,
        profile.id
      );
    }

    return NextResponse.json(reply, { status: 201 });
  } catch (error) {
    console.error("POST /api/account/reviews/[id]/replies error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
