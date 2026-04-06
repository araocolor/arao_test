import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncProfile } from "@/lib/profiles";
import { createNotification } from "@/lib/notifications";

const SOFT_DELETED_PARENT_TEXT = "댓글이 삭제되었습니다.";

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
  let viewerProfileId: string | null = null;
  if (userId) {
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
    const profile = await syncProfile({ email });
    viewerProfileId = profile?.id ?? null;
  }
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("user_review_comments")
    .select("id, content, created_at, is_deleted, parent_id, profile_id, like_count, profile:profile_id(username, email, icon_image)")
    .eq("review_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ comments: [] });

  const commentIds = (data ?? []).map((r: any) => r.id);
  let likedSet = new Set<string>();
  if (viewerProfileId && commentIds.length > 0) {
    const { data: likeRows } = await supabase
      .from("user_review_comment_likes")
      .select("comment_id")
      .eq("profile_id", viewerProfileId)
      .in("comment_id", commentIds);
    likedSet = new Set((likeRows ?? []).map((r: any) => r.comment_id));
  }

  const comments = (data ?? [])
    .filter((row: any) => !(row.is_deleted && row.parent_id))
    .map((row: any) => {
    const p = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    const authorId = p?.username || (p?.email ? maskEmail(p.email) : "익명");
    return {
      id: row.id,
      content: row.is_deleted ? SOFT_DELETED_PARENT_TEXT : row.content,
      isDeleted: row.is_deleted,
      createdAt: row.created_at,
      parentId: row.parent_id ?? null,
      authorId,
      iconImage: p?.icon_image ?? null,
      isMine: viewerProfileId ? viewerProfileId === row.profile_id : false,
      likeCount: row.like_count ?? 0,
      liked: likedSet.has(row.id),
    };
  });

  return NextResponse.json({ comments });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  const profile = await syncProfile({ email });
  if (!profile) return NextResponse.json({ message: "프로필을 찾을 수 없습니다." }, { status: 404 });

  const body = (await request.json()) as { content?: string; parentId?: string | null };
  const content = (body.content ?? "").trim();
  if (!content) return NextResponse.json({ message: "내용을 입력해주세요." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const rawParentId = typeof body.parentId === "string" ? body.parentId.trim() : "";
  let parentId: string | null = rawParentId || null;
  let parentCommentAuthorProfileId: string | null = null;

  if (parentId) {
    const { data: parentComment, error: parentError } = await supabase
      .from("user_review_comments")
      .select("id, review_id, parent_id, profile_id")
      .eq("id", parentId)
      .eq("review_id", id)
      .maybeSingle();

    if (parentError || !parentComment) {
      return NextResponse.json({ message: "원댓글을 찾을 수 없습니다." }, { status: 400 });
    }

    // 대댓글의 대댓글 요청은 1단계로 정규화
    parentId = parentComment.parent_id ?? parentComment.id;
    parentCommentAuthorProfileId = parentComment.profile_id ?? null;
  }

  const { data, error } = await supabase
    .from("user_review_comments")
    .insert({ review_id: id, profile_id: profile.id, content, parent_id: parentId })
    .select("id, content, created_at, parent_id")
    .single();

  if (error) return NextResponse.json({ message: "댓글 저장 실패" }, { status: 500 });

  const authorId = profile.username || (profile.email ? maskEmail(profile.email) : "익명");
  const commenterName = profile.username || (profile.email ? maskEmail(profile.email) : null) || "누군가";
  const { data: review } = await supabase
    .from("user_reviews")
    .select("profile_id")
    .eq("id", id)
    .maybeSingle();

  if (review?.profile_id && review.profile_id !== profile.id) {
    await createNotification(
      review.profile_id,
      "review_comment",
      `${commenterName}님이 댓글을 남겼습니다`,
      `/user_content/${id}?commentId=${data.id}`,
      `review-comment:${data.id}:owner`,
      profile.icon_image ?? null
    );
  }

  if (
    parentCommentAuthorProfileId &&
    parentCommentAuthorProfileId !== profile.id &&
    parentCommentAuthorProfileId !== review?.profile_id
  ) {
    await createNotification(
      parentCommentAuthorProfileId,
      "review_comment",
      `${commenterName}님이 답글을 남겼습니다`,
      `/user_content/${id}?commentId=${data.id}`,
      `review-comment:${data.id}:parent`,
      profile.icon_image ?? null
    );
  }

  return NextResponse.json({
    id: data.id,
    content: data.content,
    createdAt: data.created_at,
    parentId: data.parent_id ?? null,
    authorId,
    iconImage: profile.icon_image ?? null,
    isDeleted: false,
    likeCount: 0,
    liked: false,
    isMine: true,
  }, { status: 201 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  const profile = await syncProfile({ email });
  if (!profile) return NextResponse.json({ message: "프로필을 찾을 수 없습니다." }, { status: 404 });

  const body = (await request.json()) as { commentId?: string; content?: string };
  const commentId = (body.commentId ?? "").trim();
  const content = (body.content ?? "").trim();
  if (!commentId || !content) return NextResponse.json({ message: "내용을 입력해주세요." }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("user_review_comments")
    .update({ content })
    .eq("id", commentId)
    .eq("review_id", id)
    .eq("profile_id", profile.id)
    .eq("is_deleted", false);

  if (error) return NextResponse.json({ message: "댓글 수정 실패" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  const profile = await syncProfile({ email });
  if (!profile) return NextResponse.json({ message: "프로필을 찾을 수 없습니다." }, { status: 404 });

  const body = (await request.json()) as { commentId?: string };
  const commentId = (body.commentId ?? "").trim();
  if (!commentId) return NextResponse.json({ message: "commentId가 필요합니다." }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: targetComment, error: targetCommentError } = await supabase
    .from("user_review_comments")
    .select("id, parent_id")
    .eq("id", commentId)
    .eq("review_id", id)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (targetCommentError) return NextResponse.json({ message: "댓글 삭제 실패" }, { status: 500 });
  if (!targetComment) return NextResponse.json({ message: "댓글을 찾을 수 없습니다." }, { status: 404 });

  const isReply = !!targetComment.parent_id;

  if (isReply) {
    const { error: deleteReplyError } = await supabase
      .from("user_review_comments")
      .delete()
      .eq("id", commentId)
      .eq("review_id", id)
      .eq("profile_id", profile.id);

    if (deleteReplyError) return NextResponse.json({ message: "댓글 삭제 실패" }, { status: 500 });
    return NextResponse.json({ ok: true, mode: "hard" as const, commentId });
  }

  const { count: replyCount, error: replyCountError } = await supabase
    .from("user_review_comments")
    .select("id", { count: "exact", head: true })
    .eq("review_id", id)
    .eq("parent_id", commentId);

  if (replyCountError) return NextResponse.json({ message: "댓글 삭제 실패" }, { status: 500 });

  if ((replyCount ?? 0) > 0) {
    const { error: softDeleteError } = await supabase
      .from("user_review_comments")
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq("id", commentId)
      .eq("review_id", id)
      .eq("profile_id", profile.id);

    if (softDeleteError) return NextResponse.json({ message: "댓글 삭제 실패" }, { status: 500 });
    return NextResponse.json({ ok: true, mode: "soft" as const, commentId, content: SOFT_DELETED_PARENT_TEXT });
  }

  const { error: deleteRootError } = await supabase
    .from("user_review_comments")
    .delete()
    .eq("id", commentId)
    .eq("review_id", id)
    .eq("profile_id", profile.id);

  if (deleteRootError) return NextResponse.json({ message: "댓글 삭제 실패" }, { status: 500 });

  return NextResponse.json({ ok: true, mode: "hard" as const, commentId });
}
