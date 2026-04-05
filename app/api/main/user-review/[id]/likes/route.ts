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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  const supabase = createSupabaseAdminClient();

  const { count } = await supabase
    .from("user_review_likes")
    .select("*", { count: "exact", head: true })
    .eq("review_id", id);

  let liked = false;
  if (userId) {
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
    const profile = await syncProfile({ email });
    if (profile) {
      const { data } = await supabase
        .from("user_review_likes")
        .select("review_id")
        .eq("review_id", id)
        .eq("profile_id", profile.id)
        .maybeSingle();
      liked = !!data;
    }
  }

  return NextResponse.json({ likeCount: count ?? 0, liked });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  const profile = await syncProfile({ email });
  if (!profile) return NextResponse.json({ message: "프로필을 찾을 수 없습니다." }, { status: 404 });

  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase
    .from("user_review_likes")
    .select("review_id")
    .eq("review_id", id)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("user_review_likes").delete().eq("review_id", id).eq("profile_id", profile.id);
    await supabase.from("user_reviews").update({ like_count: 0 }).eq("id", id); // 재집계
    const { count } = await supabase.from("user_review_likes").select("*", { count: "exact", head: true }).eq("review_id", id);
    await supabase.from("user_reviews").update({ like_count: count ?? 0 }).eq("id", id);
    return NextResponse.json({ liked: false, likeCount: count ?? 0 });
  } else {
    await supabase.from("user_review_likes").insert({ review_id: id, profile_id: profile.id });
    const { count } = await supabase.from("user_review_likes").select("*", { count: "exact", head: true }).eq("review_id", id);
    await supabase.from("user_reviews").update({ like_count: count ?? 0 }).eq("id", id);

    const [{ data: review }, { data: liker }] = await Promise.all([
      supabase
        .from("user_reviews")
        .select("profile_id")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("username, email, icon_image")
        .eq("id", profile.id)
        .maybeSingle(),
    ]);

    if (review?.profile_id && review.profile_id !== profile.id) {
      const likerName =
        liker?.username || (liker?.email ? maskEmail(liker.email) : null) || "누군가";
      await createNotification(
        review.profile_id,
        "review_like",
        `${likerName}님이 좋아요를 남겼습니다`,
        `/user_content/${id}`,
        `review-like:${id}:${profile.id}`,
        liker?.icon_image ?? null
      );
    }

    return NextResponse.json({ liked: true, likeCount: count ?? 0 });
  }
}
