import { auth, currentUser } from "@clerk/nextjs/server";
import { toggleGalleryCommentLike } from "@/lib/gallery-interactions";
import { createNotification } from "@/lib/notifications";
import { syncProfile } from "@/lib/profiles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex < 0) return email;
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  return `${local.slice(0, 2)}***${domain}`;
}

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

    // 댓글 작성자 조회
    const supabase = createSupabaseAdminClient();
    const { data: comment, error: commentError } = await supabase
      .from("gallery_comments")
      .select("profile_id, item_category, item_index")
      .eq("id", id)
      .single();

    if (commentError || !comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const result = await toggleGalleryCommentLike(id, profile.id, comment.profile_id);

    if (!result) {
      return NextResponse.json({ error: "Failed to toggle like" }, { status: 500 });
    }

    // 댓글 작성자에게 알림 생성 (본인이 아닌 경우, 좋아요 ON인 경우만)
    if (result.liked && comment.profile_id !== profile.id) {
      await createNotification(
        comment.profile_id,
        "gallery_like",
        `${profile.username || (profile.email ? maskEmail(profile.email) : null) || "사용자"}님이 좋아요를 남겼습니다`,
        `/gallery?category=${comment.item_category}&index=${comment.item_index}&commentId=${id}`,
        id,
        profile.icon_image ?? null,
        profile.id
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/gallery/comments/[id]/likes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
