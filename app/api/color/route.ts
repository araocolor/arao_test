import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncProfile } from "@/lib/profiles";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? "20")));
    const offset = (page - 1) * limit;

    const supabase = createSupabaseAdminClient();
    const { data, count, error } = await supabase
      .from("colors")
      .select(
        "id, title, content, price, file_link, img_arao_full, img_arao_mid, img_arao_thumb, img_standard_full, img_portrait_full, like_count, created_at, profile_id, is_admin",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return NextResponse.json({ items: data ?? [], total: count ?? 0, page, limit });
  } catch (error) {
    console.error("GET /api/color error:", error);
    return NextResponse.json({ items: [], total: 0, page: 1, limit: 20 }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;
  const profile = await syncProfile({ email, fullName });
  if (!profile) return NextResponse.json({ message: "프로필을 찾을 수 없습니다." }, { status: 404 });

  try {
    const body = (await request.json()) as {
      title?: string;
      content?: string;
      price?: number | null;
      file_link?: string | null;
      img_standard_full?: string | null;
      img_standard_mid?: string | null;
      img_standard_thumb?: string | null;
      img_portrait_full?: string | null;
      img_portrait_mid?: string | null;
      img_portrait_thumb?: string | null;
      img_arao_full?: string | null;
      img_arao_mid?: string | null;
      img_arao_thumb?: string | null;
    };

    const title = (body.title ?? "").trim();
    if (!title) return NextResponse.json({ message: "제목을 입력해주세요." }, { status: 400 });

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("colors")
      .insert({
        profile_id: profile.id,
        is_admin: profile.role === "admin",
        title,
        content: (body.content ?? "").trim() || null,
        price: body.price ?? null,
        file_link: body.file_link?.trim() || null,
        img_standard_full: body.img_standard_full ?? null,
        img_standard_mid: body.img_standard_mid ?? null,
        img_standard_thumb: body.img_standard_thumb ?? null,
        img_portrait_full: body.img_portrait_full ?? null,
        img_portrait_mid: body.img_portrait_mid ?? null,
        img_portrait_thumb: body.img_portrait_thumb ?? null,
        img_arao_full: body.img_arao_full ?? null,
        img_arao_mid: body.img_arao_mid ?? null,
        img_arao_thumb: body.img_arao_thumb ?? null,
        like_count: 0,
      })
      .select("id")
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error("POST /api/color error:", error);
    return NextResponse.json({ message: "저장에 실패했습니다." }, { status: 500 });
  }
}
