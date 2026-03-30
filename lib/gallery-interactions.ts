import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";

export type GalleryComment = {
  id: string;
  profile_id: string;
  item_category: string;
  item_index: number;
  content: string;
  like_count: number;
  created_at: string;
  author_username: string | null;
  author_fullname: string | null;
  author_icon_image: string | null;
  author_email: string | null;
};

/**
 * 갤러리 이미지 좋아요 상태 조회
 */
export async function getGalleryItemLikeStatus(
  category: string,
  index: number,
  profileId?: string
): Promise<{ count: number; liked: boolean; firstLiker: string | null; commentCount: number }> {
  const supabase = createSupabaseAdminClient();

  const [{ count }, { count: commentCount }] = await Promise.all([
    supabase.from("gallery_item_likes").select("*", { count: "exact" }).eq("item_category", category).eq("item_index", index),
    supabase.from("gallery_comments").select("*", { count: "exact" }).eq("item_category", category).eq("item_index", index),
  ]);

  let liked = false;
  if (profileId) {
    const { data } = await supabase
      .from("gallery_item_likes")
      .select("*")
      .eq("item_category", category)
      .eq("item_index", index)
      .eq("profile_id", profileId)
      .single();
    liked = !!data;
  }

  // 첫 번째 좋아요한 사용자 이름
  let firstLiker: string | null = null;
  if ((count ?? 0) > 0) {
    const { data: firstLike } = await supabase
      .from("gallery_item_likes")
      .select("profile_id")
      .eq("item_category", category)
      .eq("item_index", index)
      .limit(1)
      .single();

    if (firstLike) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", firstLike.profile_id)
        .single();
      firstLiker = profile?.username ?? null;
    }
  }

  return { count: count ?? 0, liked, firstLiker, commentCount: commentCount ?? 0 };
}

/**
 * 갤러리 이미지 좋아요 토글
 */
export async function toggleGalleryItemLike(
  category: string,
  index: number,
  profileId: string
): Promise<{ liked: boolean; count: number } | null> {
  const supabase = createSupabaseAdminClient();

  // 현재 좋아요 상태 확인
  const { data: existing } = await supabase
    .from("gallery_item_likes")
    .select("*")
    .eq("item_category", category)
    .eq("item_index", index)
    .eq("profile_id", profileId)
    .single();

  if (existing) {
    // 이미 좋아요 상태 → 제거
    const { error } = await supabase
      .from("gallery_item_likes")
      .delete()
      .eq("item_category", category)
      .eq("item_index", index)
      .eq("profile_id", profileId);

    if (error) {
      console.error("toggleGalleryItemLike delete error:", error);
      return null;
    }

    const { count } = await supabase
      .from("gallery_item_likes")
      .select("*", { count: "exact" })
      .eq("item_category", category)
      .eq("item_index", index);

    return { liked: false, count: count ?? 0 };
  } else {
    // 좋아요 추가
    const { error } = await supabase
      .from("gallery_item_likes")
      .insert({ item_category: category, item_index: index, profile_id: profileId });

    if (error) {
      console.error("toggleGalleryItemLike insert error:", error);
      return null;
    }

    const { count } = await supabase
      .from("gallery_item_likes")
      .select("*", { count: "exact" })
      .eq("item_category", category)
      .eq("item_index", index);

    return { liked: true, count: count ?? 0 };
  }
}

/**
 * 갤러리 댓글 목록 조회
 */
export async function getGalleryComments(
  category: string,
  index: number
): Promise<GalleryComment[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("gallery_comments")
    .select("*, profile:profile_id(username, full_name, icon_image, email)")
    .eq("item_category", category)
    .eq("item_index", index)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getGalleryComments error:", error);
    return [];
  }

  return (data ?? []).map((c) => ({
    ...c,
    author_username: c.profile?.username || null,
    author_fullname: c.profile?.full_name || null,
    author_icon_image: c.profile?.icon_image || null,
    author_email: c.profile?.email || null,
    profile: undefined,
  })) as GalleryComment[];
}

/**
 * 갤러리 댓글 작성
 */
export async function createGalleryComment(
  category: string,
  index: number,
  profileId: string,
  content: string
): Promise<GalleryComment | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("gallery_comments")
    .insert({
      profile_id: profileId,
      item_category: category,
      item_index: index,
      content,
      like_count: 0,
    })
    .select()
    .single();

  if (error) {
    console.error("createGalleryComment error:", error);
    return null;
  }

  // 프로필 정보 가져오기 (author_username/fullname 채우기)
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, full_name, icon_image, email")
    .eq("id", profileId)
    .single();

  return {
    ...data,
    author_username: profile?.username || null,
    author_fullname: profile?.full_name || null,
    author_icon_image: profile?.icon_image || null,
    author_email: profile?.email || null,
  } as GalleryComment;
}

/**
 * 갤러리 댓글 좋아요 토글 (commentAuthorProfileId는 알림 생성용)
 */
export async function toggleGalleryCommentLike(
  commentId: string,
  profileId: string,
  commentAuthorProfileId: string
): Promise<{ liked: boolean; count: number } | null> {
  const supabase = createSupabaseAdminClient();

  // 현재 좋아요 상태 확인
  const { data: existing } = await supabase
    .from("gallery_comment_likes")
    .select("*")
    .eq("comment_id", commentId)
    .eq("profile_id", profileId)
    .single();

  if (existing) {
    // 이미 좋아요 상태 → 제거
    const { error } = await supabase
      .from("gallery_comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("profile_id", profileId);

    if (error) {
      console.error("toggleGalleryCommentLike delete error:", error);
      return null;
    }

    // like_count 감소
    const { data: comment } = await supabase
      .from("gallery_comments")
      .select("like_count")
      .eq("id", commentId)
      .single();

    if (comment && comment.like_count > 0) {
      await supabase
        .from("gallery_comments")
        .update({ like_count: comment.like_count - 1 })
        .eq("id", commentId);
    }

    const likeCount = Math.max((comment?.like_count ?? 0) - 1, 0);
    return { liked: false, count: likeCount };
  } else {
    // 좋아요 추가
    const { error } = await supabase
      .from("gallery_comment_likes")
      .insert({ comment_id: commentId, profile_id: profileId });

    if (error) {
      console.error("toggleGalleryCommentLike insert error:", error);
      return null;
    }

    // like_count 증가
    const { data: comment } = await supabase
      .from("gallery_comments")
      .select("like_count")
      .eq("id", commentId)
      .single();

    if (comment) {
      await supabase
        .from("gallery_comments")
        .update({ like_count: comment.like_count + 1 })
        .eq("id", commentId);
    }

    const likeCount = (comment?.like_count ?? 0) + 1;

    // 댓글 작성자에게 알림 생성 (본인 제외)
    if (commentAuthorProfileId !== profileId) {
      const { data: liker } = await supabase
        .from("profiles")
        .select("username, email")
        .eq("id", profileId)
        .single();

      const { data: commentData } = await supabase
        .from("gallery_comments")
        .select("item_category, item_index")
        .eq("id", commentId)
        .single();

      if (commentData) {
        const likerName = liker?.username || liker?.email || "누군가";
        await createNotification(
          commentAuthorProfileId,
          "gallery_like",
          `${likerName}님이 좋아요 하트를 남겼습니다`,
          `/gallery`,
          commentId
        );
      }
    }

    return { liked: true, count: likeCount };
  }
}
