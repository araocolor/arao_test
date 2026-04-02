import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type UserReviewSort = "latest" | "views" | "likes";

export type UserReviewListItem = {
  id: string;
  title: string;
  content: string;
  thumbnailImage: string | null;
  attachedFile: string | null;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  authorId: string;
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
    attachedFile: row.attached_file ?? null,
    viewCount: row.view_count ?? 0,
    likeCount: row.like_count ?? 0,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    authorId: mapAuthorId(row),
  };
}

function sortRows(rows: any[], sort: UserReviewSort) {
  if (sort === "views") {
    return rows.sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0));
  }
  if (sort === "likes") {
    return rows.sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0));
  }
  return rows.sort((a, b) => {
    const aTime = new Date(a.created_at ?? 0).getTime();
    const bTime = new Date(b.created_at ?? 0).getTime();
    return bTime - aTime;
  });
}

export async function getUserReviewList(params: {
  page: number;
  limit: number;
  q?: string;
  sort?: UserReviewSort;
}): Promise<{ items: UserReviewListItem[]; total: number }> {
  const { page, limit } = params;
  const q = (params.q ?? "").trim().toLowerCase();
  const sort = params.sort ?? "latest";
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("user_reviews")
    .select("id, profile_id, title, content, thumbnail_image, view_count, like_count, is_public, created_at, updated_at, profile:profile_id(username, email)");

  if (error) {
    // user_reviews 테이블 미생성 상태를 포함해 안전하게 빈 목록 반환
    console.error("getUserReviewList error:", error);
    return { items: [], total: 0 };
  }

  const raw = Array.isArray(data) ? data : [];
  const searched = q
    ? raw.filter((row) => {
        const title = String(row.title ?? "").toLowerCase();
        const content = String(row.content ?? "").toLowerCase();
        const profile = getProfile(row);
        const username = String(profile?.username ?? "").toLowerCase();
        const email = String(profile?.email ?? "").toLowerCase();
        return (
          title.includes(q) ||
          content.includes(q) ||
          username.includes(q) ||
          email.includes(q)
        );
      })
    : raw;

  const sorted = sortRows([...searched], sort);
  const total = sorted.length;
  const safePage = Math.max(page, 1);
  const start = (safePage - 1) * limit;
  const end = start + limit;
  const items = sorted.slice(start, end).map(mapRowToListItem);
  return { items, total };
}

export async function getUserReviewById(id: string): Promise<UserReviewDetail | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_reviews")
    .select("id, profile_id, title, content, thumbnail_image, thumbnail_small, attached_file, view_count, like_count, is_public, created_at, updated_at, profile:profile_id(username, email)")
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
}): Promise<{ id: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_reviews")
    .insert({
      profile_id: params.profileId,
      category: params.category,
      title: params.title,
      content: params.content,
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
