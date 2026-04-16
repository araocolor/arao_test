import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getColorById } from "@/lib/colors";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  void request;

  try {
    const { id } = await params;
    const item = await getColorById(id);

    if (!item) {
      return NextResponse.json({ message: "컬러를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error("GET /api/color/[id] error:", error);
    return NextResponse.json({ message: "컬러 정보를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;

  try {
    const body = (await request.json()) as {
      title?: string;
      content?: string | null;
      price?: number | null;
      img_standard_full?: string | null;
      img_standard_mid?: string | null;
      img_standard_thumb?: string | null;
      img_portrait_full?: string | null;
      img_portrait_mid?: string | null;
      img_portrait_thumb?: string | null;
      img_arao_full?: string | null;
      img_arao_mid?: string | null;
      img_arao_thumb?: string | null;
      file_link?: string | null;
    };

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("colors")
      .update({
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.content !== undefined ? { content: body.content } : {}),
        ...(body.price !== undefined ? { price: body.price } : {}),
        img_standard_full: body.img_standard_full ?? null,
        img_standard_mid: body.img_standard_mid ?? null,
        img_standard_thumb: body.img_standard_thumb ?? null,
        img_portrait_full: body.img_portrait_full ?? null,
        img_portrait_mid: body.img_portrait_mid ?? null,
        img_portrait_thumb: body.img_portrait_thumb ?? null,
        img_arao_full: body.img_arao_full ?? null,
        img_arao_mid: body.img_arao_mid ?? null,
        img_arao_thumb: body.img_arao_thumb ?? null,
        ...(body.file_link !== undefined ? { file_link: body.file_link } : {}),
      })
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/color/[id] error:", error);
    return NextResponse.json({ message: "업데이트에 실패했습니다." }, { status: 500 });
  }
}
