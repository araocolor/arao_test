import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type UserReviewSort = "latest" | "views" | "likes";

export type UserReviewListItem = {
  id: string;
  title: string;
  content: string;
  thumbnailImage: string | null;
  thumbnailFirst: string | null;
  attachedFile: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  authorId: string;
  authorEmail: string | null;
  authorIconImage: string | null;
  authorTier: string | null;
  isAuthor: boolean;
  board: string;
  isPinned: boolean;
  isGlobalPinned: boolean;
};

export type UserReviewDetail = UserReviewListItem & {
  profileId: string;
  isPublic: boolean;
  updatedAt: string;
  thumbnailSmall: string | null;
};

function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex < 0) return email;
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  return `${local.slice(0, 2)}***${domain}`;
}

type ProfileShape = { username?: string | null; email?: string | null; icon_image?: string | null; tier?: string | null };

function getProfile(
  row: {
    profile?: ProfileShape | Array<ProfileShape> | null;
  }
): ProfileShape | null {
  if (!row.profile) return null;
  if (Array.isArray(row.profile)) return row.profile[0] ?? null;
  return row.profile;
}

function mapAuthorId(row: {
  profile?: ProfileShape | Array<ProfileShape> | null;
}): string {
  const profile = getProfile(row);
  if (profile?.username) return profile.username;
  if (profile?.email) return maskEmail(profile.email);
  return "익명";
}

function mapRowToListItem(row: any, viewerProfileId?: string | null): UserReviewListItem {
  const profile = getProfile(row);
  return {
    id: row.id,
    title: row.title ?? "",
    content: row.content ?? "",
    thumbnailImage: row.thumbnail_image ?? null,
    thumbnailFirst: row.thumbnail_first ?? null,
    attachedFile: row.attached_file ?? null,
    viewCount: row.view_count ?? 0,
    likeCount: row.like_count ?? 0,
    commentCount: Array.isArray(row.comment_count) ? (row.comment_count[0]?.count ?? 0) : (typeof row.comment_count === "number" ? row.comment_count : 0),
    createdAt: row.created_at ?? new Date(0).toISOString(),
    authorId: mapAuthorId(row),
    authorEmail: profile?.email ? maskEmail(profile.email) : null,
    authorIconImage: profile?.icon_image ?? null,
    authorTier: profile?.tier ?? null,
    isAuthor: !!viewerProfileId && row.profile_id === viewerProfileId,
    board: row.board ?? "review",
    isPinned: !!row.is_pinned,
    isGlobalPinned: !!row.is_global_pinned,
  };
}

function normalizeSearchTerm(value: string): string {
  return value.replace(/[(),]/g, " ").trim();
}

export async function getUserReviewList(params: {
  page: number;
  limit: number;
  q?: string;
  sort?: UserReviewSort;
  board?: string;
  viewerProfileId?: string | null;
}): Promise<{ items: UserReviewListItem[]; total: number }> {
  const { page, limit } = params;
  const q = normalizeSearchTerm((params.q ?? "").trim());
  const sort = params.sort ?? "latest";
  const board = params.board ?? "review";
  const supabase = createSupabaseAdminClient();
  const safePage = Math.max(page, 1);
  const start = (safePage - 1) * limit;
  const end = start + limit - 1;

  let query = supabase
    .from("user_reviews")
    .select(
      "id, profile_id, title, content, thumbnail_image, thumbnail_first, attached_file, view_count, like_count, is_public, board, is_pinned, is_global_pinned, created_at, updated_at, profile:profile_id(username, email, icon_image, tier)",
      { count: "exact" }
    )
    .or(`board.eq.${board},is_global_pinned.eq.true`);

  if (q) {
    const escapedQ = q.replace(/[%_\\]/g, "\\$&");
    const pattern = `%${escapedQ}%`;
    const { data: matchedProfiles } = await supabase
      .from("profiles")
      .select("id")
      .or(`username.ilike.${pattern},email.ilike.${pattern}`)
      .limit(200);
    const profileIds = (matchedProfiles ?? [])
      .map((profile) => profile.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    const profileFilter = profileIds.length > 0 ? `,profile_id.in.(${profileIds.join(",")})` : "";
    query = query.or(`title.ilike.${pattern},content.ilike.${pattern}${profileFilter}`);
  }

  query = query
    .order("is_global_pinned", { ascending: false })
    .order("is_pinned", { ascending: false });
  if (sort === "views") {
    query = query.order("view_count", { ascending: false }).order("created_at", { ascending: false });
  } else if (sort === "likes") {
    query = query.order("like_count", { ascending: false }).order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  query = query.range(start, end);

  const { data, error, count } = await query;

  if (error) {
    console.error("getUserReviewList error:", error);
    return { items: [], total: 0 };
  }

  const items = (Array.isArray(data) ? data : []).map((row) => mapRowToListItem(row, params.viewerProfileId));

  if (items.length > 0) {
    const reviewIds = items.map((item) => item.id);
    const { data: commentRows, error: commentError } = await supabase
      .from("user_review_comments")
      .select("review_id")
      .in("review_id", reviewIds)
      .eq("is_deleted", false);

    if (!commentError && Array.isArray(commentRows)) {
      const countByReviewId = new Map<string, number>();
      commentRows.forEach((row: any) => {
        const reviewId = row?.review_id;
        if (typeof reviewId !== "string") return;
        countByReviewId.set(reviewId, (countByReviewId.get(reviewId) ?? 0) + 1);
      });
      items.forEach((item) => {
        item.commentCount = countByReviewId.get(item.id) ?? 0;
      });
    }
  }

  return { items, total: count ?? 0 };
}

export async function getUserReviewById(id: string): Promise<UserReviewDetail | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_reviews")
    .select("id, profile_id, title, content, thumbnail_image, thumbnail_small, thumbnail_first, attached_file, view_count, like_count, is_public, board, is_pinned, is_global_pinned, created_at, updated_at, profile:profile_id(username, email, icon_image, tier)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getUserReviewById error:", error);
    return null;
  }

  return {
    ...mapRowToListItem(data, null),
    profileId: data.profile_id,
    isPublic: data.is_public ?? true,
    updatedAt: data.updated_at ?? data.created_at ?? new Date(0).toISOString(),
    thumbnailSmall: data.thumbnail_small ?? null,
  };
}

export async function createUserReview(params: {
  profileId: string;
  category: string;
  title: string;
  content: string;
  thumbnailImage?: string;
  thumbnailSmall?: string;
  attachedFile?: string;
  board?: string;
  isPinned?: boolean;
  isGlobalPinned?: boolean;
}): Promise<{ id: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_reviews")
    .insert({
      profile_id: params.profileId,
      category: params.category,
      title: params.title,
      content: params.content,
      board: params.board ?? "review",
      is_pinned: !!params.isPinned,
      is_global_pinned: !!params.isGlobalPinned,
      ...(params.thumbnailImage ? { thumbnail_image: params.thumbnailImage } : {}),
      ...(params.thumbnailSmall ? { thumbnail_small: params.thumbnailSmall } : {}),
      ...(params.attachedFile ? { attached_file: params.attachedFile } : {}),
    })
    .select("id")
    .single();

  if (error) {
    console.error("createUserReview error:", error);
    return null;
  }
  return { id: data.id };
}

export async function incrementUserReviewViewCount(id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("increment_user_review_view_count", { review_id: id });
  if (error) console.error("incrementUserReviewViewCount error:", error);
}
