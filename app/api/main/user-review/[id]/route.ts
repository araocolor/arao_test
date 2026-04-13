import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUserReviewById } from "@/lib/user-reviews";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncProfile } from "@/lib/profiles";

const ALLOWED_BOARDS = new Set(["notice", "review", "qna", "arao"]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, { userId }] = await Promise.all([params, auth()]);
    const item = await getUserReviewById(id);
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let isAuthor = false;
    if (userId) {
      const user = await currentUser();
      const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
      const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;
      const profile = await syncProfile({ email, fullName });
      isAuthor = !!profile && profile.id === item.profileId;
    }

    return NextResponse.json({ ...item, isAuthor });
  } catch (error) {
    console.error("GET /api/main/user-review/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const item = await getUserReviewById(id);
  if (!item) return NextResponse.json({ message: "게시글을 찾을 수 없습니다." }, { status: 404 });

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;
  const profile = await syncProfile({ email, fullName });
  if (!profile || profile.id !== item.profileId) return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });

  const body = (await request.json()) as {
    category?: string;
    title?: string;
    content?: string;
    thumbnailImage?: string | null;
    thumbnailSmall?: string | null;
    thumbnailFirst?: string | null;
    attachedFile?: string | null;
    board?: string;
    isPinned?: boolean;
    isGlobalPinned?: boolean;
  };
  const title = (body.title ?? "").trim();
  const content = (body.content ?? "").trim();
  const category = (body.category ?? "일반").trim();
  if (!title) return NextResponse.json({ message: "제목을 입력해주세요." }, { status: 400 });

  const isAdmin = profile.role === "admin";
  const supabase = createSupabaseAdminClient();
  const updateData: Record<string, unknown> = { title, content, category, updated_at: new Date().toISOString() };
  if (body.thumbnailImage !== undefined) updateData.thumbnail_image = body.thumbnailImage;
  if (body.thumbnailSmall !== undefined) updateData.thumbnail_small = body.thumbnailSmall;
  if (body.thumbnailFirst !== undefined) updateData.thumbnail_first = body.thumbnailFirst;
  if (body.attachedFile !== undefined) updateData.attached_file = body.attachedFile;
  if (isAdmin && body.isPinned !== undefined) updateData.is_pinned = !!body.isPinned;
  if (isAdmin && body.isGlobalPinned !== undefined) {
    updateData.is_global_pinned = !!body.isGlobalPinned && !!(body.isPinned ?? false);
  }
  if (body.board !== undefined) {
    const board = body.board.trim();
    if (!ALLOWED_BOARDS.has(board)) {
      return NextResponse.json({ message: "유효하지 않은 게시판입니다." }, { status: 400 });
    }
    updateData.board = board;
  }

  const { error } = await supabase.from("user_reviews").update(updateData).eq("id", id);
  if (error) return NextResponse.json({ message: "수정 실패" }, { status: 500 });

  return NextResponse.json({ id });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const item = await getUserReviewById(id);
  if (!item) return NextResponse.json({ message: "게시글을 찾을 수 없습니다." }, { status: 404 });

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;
  const profile = await syncProfile({ email, fullName });
  if (!profile || profile.id !== item.profileId) return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("user_reviews").delete().eq("id", id);
  if (error) return NextResponse.json({ message: "삭제 실패" }, { status: 500 });

  return NextResponse.json({ success: true });
}
