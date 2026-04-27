import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncProfile } from "@/lib/profiles";
import { createNotification } from "@/lib/notifications";

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 0) return email;
  return `${email.slice(0, 2)}***${email.slice(at)}`;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });

  const { commentId } = await params;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  const profile = await syncProfile({ email });
  if (!profile) return NextResponse.json({ message: "프로필을 찾을 수 없습니다." }, { status: 404 });

  const supabase = createSupabaseAdminClient();
  const { data: targetComment } = await supabase
    .from("user_review_comments")
    .select("id, review_id, profile_id")
    .eq("id", commentId)
    .maybeSingle();

  if (!targetComment) {
    return NextResponse.json({ message: "댓글을 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("user_review_comment_likes")
    .select("comment_id")
    .eq("comment_id", commentId)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("user_review_comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("profile_id", profile.id);
    const { data: row } = await supabase
      .from("user_review_comments")
      .select("like_count")
      .eq("id", commentId)
      .maybeSingle();
    const next = Math.max((row?.like_count ?? 1) - 1, 0);
    await supabase.from("user_review_comments").update({ like_count: next }).eq("id", commentId);
    return NextResponse.json({ liked: false, likeCount: next });
  }

  await supabase.from("user_review_comment_likes").insert({ comment_id: commentId, profile_id: profile.id });
  const { data: row } = await supabase.from("user_review_comments").select("like_count").eq("id", commentId).maybeSingle();
  const next = (row?.like_count ?? 0) + 1;
  await supabase.from("user_review_comments").update({ like_count: next }).eq("id", commentId);

  if (targetComment.profile_id && targetComment.profile_id !== profile.id) {
    const { data: liker } = await supabase
      .from("profiles")
      .select("username, email, icon_image")
      .eq("id", profile.id)
      .maybeSingle();
    const likerName =
      liker?.username || (liker?.email ? maskEmail(liker.email) : null) || "누군가";
    await createNotification(
      targetComment.profile_id,
      "review_comment_like",
      `${likerName}님이 댓글 좋아요를 남겼습니다`,
      `/user_content/${targetComment.review_id}?commentId=${commentId}`,
      `review-comment-like:${commentId}:${profile.id}`,
      liker?.icon_image ?? null,
      profile.id
    );
  }

  return NextResponse.json({ liked: true, likeCount: next });
}
