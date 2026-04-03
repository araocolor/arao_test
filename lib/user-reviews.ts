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
  createdAt: string;
  authorId: string;
  board: string;
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

function getProfile(
  row: { profile?: { username?: string | null; email?: string | null } | Array<{ username?: string | null; email?: string | null }> | null }
): { username?: string | null; email?: string | null } | null {
  if (!row.profile) return null;
  if (Array.isArray(row.profile)) return row.profile[0] ?? null;
  return row.profile;
}

function mapAuthorId(row: {
  profile?: { username?: string | null; email?: string | null } | Array<{ username?: string | null; email?: string | null }> | null;
}): string {
  const profile = getProfile(row);
  if (profile?.username) return profile.username;
  if (profile?.email) return maskEmail(profile.email);
  return "익명";
}

function mapRowToListItem(row: any): UserReviewListItem {
  return {
    id: row.id,
    title: row.title ?? "",
    content: row.content ?? "",
    thumbnailImage: row.thumbnail_image ?? null,
    thumbnailFirst: row.thumbnail_first ?? null,
    attachedFile: row.attached_file ?? null,
    viewCount: row.view_count ?? 0,
    likeCount: row.like_count ?? 0,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    authorId: mapAuthorId(row),
    board: row.board ?? "review",
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
      "id, profile_id, title, content, thumbnail_image, thumbnail_first, attached_file, view_count, like_count, is_public, board, created_at, updated_at, profile:profile_id(username, email)",
      { count: "exact" }
    )
    .eq("board", board);

  if (q) {
    const pattern = `%${q}%`;
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

  const items = (Array.isArray(data) ? data : []).map(mapRowToListItem);
  return { items, total: count ?? 0 };
}

export async function getUserReviewById(id: string): Promise<UserReviewDetail | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_reviews")
    .select("id, profile_id, title, content, thumbnail_image, thumbnail_small, thumbnail_first, attached_file, view_count, like_count, is_public, board, created_at, updated_at, profile:profile_id(username, email)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getUserReviewById error:", error);
    return null;
  }

  return {
    ...mapRowToListItem(data),
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
