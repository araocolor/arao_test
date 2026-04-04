import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncProfile } from "@/lib/profiles";

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
  return NextResponse.json({ liked: true, likeCount: next });
}
