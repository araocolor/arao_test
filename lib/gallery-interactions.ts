import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";

const DELETED_COMMENT_TEXT = "해당 댓글이 삭제되었습니다";

function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex < 0) return email;
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  return `${local.slice(0, 2)}***${domain}`;
}

function normalizeIconImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

export type GalleryComment = {
  id: string;
  profile_id: string;
  parent_id: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  item_category: string;
  item_index: number;
  content: string;
  like_count: number;
  created_at: string;
  author_username: string | null;
  author_fullname: string | null;
  author_icon_image: string | null;
  author_email: string | null;
  author_tier: string | null;
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
 * 갤러리 이미지 좋아요 사용자 목록 조회
 */
export async function getGalleryItemLikers(
  category: string,
  index: number
): Promise<Array<{ profile_id: string; username: string | null; email: string | null; icon_image: string | null; created_at: string | null }>> {
  const supabase = createSupabaseAdminClient();

  const { data: likes, error: likesError } = await supabase
    .from("gallery_item_likes")
    .select("profile_id, created_at")
    .eq("item_category", category)
    .eq("item_index", index)
    .order("created_at", { ascending: true });

  if (likesError) {
    console.error("getGalleryItemLikers likes error:", likesError);
    return [];
  }

  const profileIds = Array.from(new Set((likes ?? []).map((l) => l.profile_id).filter(Boolean)));
  if (profileIds.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, email, icon_image, created_at")
    .in("id", profileIds);

  if (profilesError) {
    console.error("getGalleryItemLikers profiles error:", profilesError);
    return [];
  }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  return (likes ?? []).map((like) => {
    const profile = profileMap.get(like.profile_id);
    return {
      profile_id: like.profile_id,
      username: profile?.username ?? null,
      email: profile?.email ?? null,
      icon_image: normalizeIconImage(profile?.icon_image),
      created_at: profile?.created_at ?? null,
    };
  });
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
    .select("*, profile:profile_id(username, full_name, email, tier, icon_image)")
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
    author_icon_image: normalizeIconImage(c.profile?.icon_image),
    author_email: c.profile?.email || null,
    author_tier: c.profile?.tier || null,
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
  content: string,
  parentId?: string | null
): Promise<GalleryComment | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("gallery_comments")
    .insert({
      profile_id: profileId,
      parent_id: parentId ?? null,
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
    .select("username, full_name, icon_image, email, tier")
    .eq("id", profileId)
    .single();

  // 대댓글 작성 시: 부모 댓글 작성자에게 알림 (본인 제외)
  if (parentId) {
    const { data: parentComment } = await supabase
      .from("gallery_comments")
      .select("id, profile_id, item_category, item_index")
      .eq("id", parentId)
      .maybeSingle();

    if (parentComment && parentComment.profile_id !== profileId) {
      const commenterName =
        profile?.username || (profile?.email ? maskEmail(profile.email) : null) || "누군가";
      await createNotification(
        parentComment.profile_id,
        "gallery_reply",
        `${commenterName}님이 댓글을 남겼습니다`,
        `/gallery?category=${parentComment.item_category}&index=${parentComment.item_index}&commentId=${data.id}`,
        data.id,
        normalizeIconImage(profile?.icon_image),
        profileId
      );
    }
  }

  return {
    ...data,
    author_username: profile?.username || null,
    author_fullname: profile?.full_name || null,
    author_icon_image: normalizeIconImage(profile?.icon_image),
    author_email: profile?.email || null,
    author_tier: profile?.tier || null,
  } as GalleryComment;
}

/**
 * 갤러리 댓글 삭제 (본인 댓글만 가능)
 * - 부모 댓글 삭제 시 직속 대댓글도 함께 삭제
 */
export async function deleteGalleryComment(
  commentId: string,
  profileId: string
): Promise<{ deletedCount: number; softDeleted?: boolean } | null> {
  const supabase = createSupabaseAdminClient();

  const { data: target, error: targetError } = await supabase
    .from("gallery_comments")
    .select("id, profile_id, parent_id, content, item_category, item_index")
    .eq("id", commentId)
    .maybeSingle();

  if (targetError) {
    console.error("deleteGalleryComment target fetch error:", targetError);
    return null;
  }
  if (!target) return { deletedCount: 0 };
  if (target.profile_id !== profileId) return null;

  // 이미 삭제 안내 문구로 치환된 첫 댓글이면 중복 처리 방지
  if (!target.parent_id && target.content === DELETED_COMMENT_TEXT) {
    return { deletedCount: 0, softDeleted: true };
  }

  if (target.parent_id) {
    const { error } = await supabase
      .from("gallery_comments")
      .delete()
      .eq("id", commentId);
    if (error) {
      console.error("deleteGalleryComment reply delete error:", error);
      return null;
    }
    return { deletedCount: 1 };
  }

  // 첫 댓글에 대댓글이 있으면 첫 댓글은 남기고 내용만 삭제 문구로 치환
  const { count: childCount, error: childrenError } = await supabase
    .from("gallery_comments")
    .select("*", { count: "exact", head: true })
    .eq("parent_id", commentId);

  if (childrenError) {
    console.error("deleteGalleryComment children fetch error:", childrenError);
    return null;
  }

  if ((childCount ?? 0) > 0) {
    const { error: softDeleteError } = await supabase
      .from("gallery_comments")
      .update({
        content: DELETED_COMMENT_TEXT,
      })
      .eq("id", commentId);

    if (softDeleteError) {
      console.error("deleteGalleryComment soft delete error:", softDeleteError);
      return null;
    }

    // 원댓글에 대댓글을 남긴 사용자에게 원댓글 삭제 알림 (본인 제외)
    const { data: childComments, error: childCommentsError } = await supabase
      .from("gallery_comments")
      .select("profile_id")
      .eq("parent_id", commentId);

    if (childCommentsError) {
      console.error("deleteGalleryComment child comments fetch error:", childCommentsError);
    } else {
      const recipientProfileIds = Array.from(
        new Set(
          (childComments ?? [])
            .map((c) => c.profile_id)
            .filter((id): id is string => Boolean(id) && id !== profileId)
        )
      );

      if (recipientProfileIds.length > 0) {
        const { data: deleter } = await supabase
          .from("profiles")
          .select("username, email, icon_image")
          .eq("id", profileId)
          .maybeSingle();

        const deleterName =
          deleter?.username || (deleter?.email ? maskEmail(deleter.email) : null) || "누군가";

        await Promise.all(
          recipientProfileIds.map((recipientProfileId) =>
            createNotification(
              recipientProfileId,
              "gallery_comment_deleted",
              `${deleterName}님이 댓글을 삭제하였습니다`,
              `/gallery?category=${target.item_category}&index=${target.item_index}&commentId=${commentId}`,
              `${commentId}:deleted`,
              normalizeIconImage(deleter?.icon_image),
              profileId
            )
          )
        );
      }
    }

    return { deletedCount: 0, softDeleted: true };
  }

  // 대댓글이 없으면 원댓글 하드 삭제
  const { error: deleteRootError } = await supabase
    .from("gallery_comments")
    .delete()
    .eq("id", commentId);

  if (deleteRootError) {
    console.error("deleteGalleryComment root delete error:", deleteRootError);
    return null;
  }

  return { deletedCount: 1 };
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
        .select("username, email, icon_image")
        .eq("id", profileId)
        .single();

      const { data: commentData } = await supabase
        .from("gallery_comments")
        .select("item_category, item_index")
        .eq("id", commentId)
        .single();

      if (commentData) {
        const likerName = liker?.username || (liker?.email ? maskEmail(liker.email) : null) || "누군가";
        await createNotification(
          commentAuthorProfileId,
          "gallery_like",
          `${likerName}님이 좋아요를 남겼습니다`,
          `/gallery?category=${commentData.item_category}&index=${commentData.item_index}&commentId=${commentId}`,
          commentId,
          normalizeIconImage(liker?.icon_image),
          profileId
        );
      }
    }

    return { liked: true, count: likeCount };
  }
}
