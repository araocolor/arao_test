import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncProfile } from "@/lib/profiles";

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
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("user_review_comments")
    .select("id, content, created_at, is_deleted, profile:profile_id(username, email, icon_image)")
    .eq("review_id", id)
    .is("parent_id", null)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ comments: [] });

  const comments = (data ?? []).map((row: any) => {
    const p = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    const authorId = p?.username || (p?.email ? maskEmail(p.email) : "익명");
    return {
      id: row.id,
      content: row.is_deleted ? "삭제된 댓글입니다." : row.content,
      isDeleted: row.is_deleted,
      createdAt: row.created_at,
      authorId,
      iconImage: p?.icon_image ?? null,
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

  const body = (await request.json()) as { content?: string };
  const content = (body.content ?? "").trim();
  if (!content) return NextResponse.json({ message: "내용을 입력해주세요." }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_review_comments")
    .insert({ review_id: id, profile_id: profile.id, content })
    .select("id, content, created_at")
    .single();

  if (error) return NextResponse.json({ message: "댓글 저장 실패" }, { status: 500 });

  const authorId = profile.username || (profile.email ? maskEmail(profile.email) : "익명");
  return NextResponse.json({
    id: data.id,
    content: data.content,
    createdAt: data.created_at,
    authorId,
    iconImage: profile.icon_image ?? null,
    isDeleted: false,
  }, { status: 201 });
}
