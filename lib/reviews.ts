import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";

export type Review = {
  id: string;
  profile_id: string;
  category: string;
  title: string;
  content: string;
  like_count: number;
  created_at: string;
  updated_at: string;
};

export type ReviewWithAuthor = Review & {
  author_username: string | null;
  author_fullname: string | null;
};

export type ReviewReply = {
  id: string;
  review_id: string;
  profile_id: string;
  content: string;
  created_at: string;
  author_username: string | null;
};

/**
 * 리뷰 목록 조회 (페이지네이션)
 */
export async function getReviews(
  page: number = 1,
  limit: number = 10
): Promise<{ reviews: ReviewWithAuthor[]; total: number }> {
  const supabase = createSupabaseAdminClient();

  const offset = (page - 1) * limit;
  const { data, error, count } = await supabase
    .from("reviews")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("getReviews error:", JSON.stringify(error), error?.message, error?.code);
    return { reviews: [], total: 0 };
  }

  const profileIds = [...new Set((data ?? []).map((r) => r.profile_id))];
  const profileMap: Record<string, { username: string | null; full_name: string | null }> = {};

  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, full_name")
      .in("id", profileIds);

    (profiles ?? []).forEach((p) => {
      profileMap[p.id] = { username: p.username, full_name: p.full_name };
    });
  }

  const reviews = (data ?? []).map((r) => ({
    ...r,
    author_username: profileMap[r.profile_id]?.username || null,
    author_fullname: profileMap[r.profile_id]?.full_name || null,
  })) as ReviewWithAuthor[];

  return { reviews, total: count ?? 0 };
}

/**
 * 리뷰 상세 조회 + 답글 목록
 */
export async function getReviewById(id: string): Promise<{ review: ReviewWithAuthor; replies: ReviewReply[] } | null> {
  const supabase = createSupabaseAdminClient();

  const [reviewRes, repliesRes] = await Promise.all([
    supabase
      .from("reviews")
      .select("*, profile:profile_id(username, full_name)")
      .eq("id", id)
      .single(),
    supabase
      .from("review_replies")
      .select("*, profile:profile_id(username)")
      .eq("review_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (reviewRes.error) {
    console.error("getReviewById error:", reviewRes.error);
    return null;
  }

  const review = {
    ...reviewRes.data,
    author_username: reviewRes.data?.profile?.username || null,
    author_fullname: reviewRes.data?.profile?.full_name || null,
    profile: undefined,
  } as ReviewWithAuthor;

  const replies = (repliesRes.data ?? []).map((r) => ({
    ...r,
    author_username: r.profile?.username || null,
    profile: undefined,
  })) as ReviewReply[];

  return { review, replies };
}

/**
 * 새 리뷰 생성
 */
export async function createReview(
  profileId: string,
  category: string,
  title: string,
  content: string
): Promise<Review | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      profile_id: profileId,
      category,
      title,
      content,
      like_count: 0,
    })
    .select()
    .single();

  if (error) {
    console.error("createReview error:", error);
    return null;
  }

  return data as Review;
}

/**
 * 리뷰 수정 (본인만)
 */
export async function updateReview(
  id: string,
  profileId: string,
  title: string,
  content: string
): Promise<Review | null> {
  const supabase = createSupabaseAdminClient();

  // 소유권 확인
  const { data: review, error: fetchError } = await supabase
    .from("reviews")
    .select("profile_id")
    .eq("id", id)
    .single();

  if (fetchError || review?.profile_id !== profileId) {
    console.error("updateReview: ownership check failed");
    return null;
  }

  const { data, error } = await supabase
    .from("reviews")
    .update({
      title,
      content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("updateReview error:", error);
    return null;
  }

  return data as Review;
}

/**
 * 리뷰 삭제 (본인만)
 */
export async function deleteReview(id: string, profileId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();

  // 소유권 확인
  const { data: review, error: fetchError } = await supabase
    .from("reviews")
    .select("profile_id")
    .eq("id", id)
    .single();

  if (fetchError || review?.profile_id !== profileId) {
    console.error("deleteReview: ownership check failed");
    return false;
  }

  const { error } = await supabase.from("reviews").delete().eq("id", id);

  if (error) {
    console.error("deleteReview error:", error);
    return false;
  }

  return true;
}

/**
 * 리뷰 좋아요 토글
 */
export async function toggleReviewLike(
  reviewId: string,
  profileId: string
): Promise<{ liked: boolean; like_count: number } | null> {
  const supabase = createSupabaseAdminClient();

  // 현재 좋아요 상태 확인
  const { data: existing } = await supabase
    .from("review_likes")
    .select("*")
    .eq("review_id", reviewId)
    .eq("profile_id", profileId)
    .single();

  if (existing) {
    // 이미 좋아요 상태 → 제거
    const { error: deleteError } = await supabase
      .from("review_likes")
      .delete()
      .eq("review_id", reviewId)
      .eq("profile_id", profileId);

    if (deleteError) {
      console.error("toggleReviewLike delete error:", deleteError);
      return null;
    }

    // like_count 감소
    await supabase.rpc("decrement_review_likes", { review_id: reviewId });

    const { data: review } = await supabase
      .from("reviews")
      .select("like_count")
      .eq("id", reviewId)
      .single();

    return { liked: false, like_count: review?.like_count ?? 0 };
  } else {
    // 좋아요 추가
    const { error: insertError } = await supabase
      .from("review_likes")
      .insert({ review_id: reviewId, profile_id: profileId });

    if (insertError) {
      console.error("toggleReviewLike insert error:", insertError);
      return null;
    }

    // like_count 증가
    await supabase.rpc("increment_review_likes", { review_id: reviewId });

    const { data: review } = await supabase
      .from("reviews")
      .select("like_count")
      .eq("id", reviewId)
      .single();

    return { liked: true, like_count: review?.like_count ?? 0 };
  }
}

/**
 * 리뷰 답글 작성 + 원댓글 작성자에게 알림
 */
export async function createReviewReply(
  reviewId: string,
  profileId: string,
  content: string
): Promise<ReviewReply | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("review_replies")
    .insert({
      review_id: reviewId,
      profile_id: profileId,
      content,
    })
    .select()
    .single();

  if (error) {
    console.error("createReviewReply error:", error);
    return null;
  }

  // 원댓글(리뷰) 작성자 조회 후 알림 생성 (본인 제외)
  const { data: review } = await supabase
    .from("reviews")
    .select("profile_id")
    .eq("id", reviewId)
    .single();

  if (review && review.profile_id !== profileId) {
    const { data: liker } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", profileId)
      .single();

    await createNotification(
      review.profile_id,
      "review_reply",
      `${liker?.username ?? "누군가"}님이 작성한 댓글에 새로운 답글이 있습니다`,
      `/account/reviews/${reviewId}`,
      data.id
    );
  }

  return data as ReviewReply;
}

/**
 * 리뷰 답글 조회
 */
export async function getReviewReplies(reviewId: string): Promise<ReviewReply[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("review_replies")
    .select("*, profile:profile_id(username)")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getReviewReplies error:", error);
    return [];
  }

  return (data ?? []).map((r) => ({
    ...r,
    author_username: r.profile?.username || null,
    profile: undefined,
  })) as ReviewReply[];
}
