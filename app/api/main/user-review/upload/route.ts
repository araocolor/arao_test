import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const path = formData.get("path") as string | null;

  if (!file || !path) {
    return NextResponse.json({ error: "파일과 경로가 필요합니다." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from("board_image")
    .upload(path, buffer, { contentType: "image/jpeg", upsert: true });

  if (error) {
    console.error("Storage upload error:", error);
    return NextResponse.json({ error: "업로드 실패" }, { status: 500 });
  }

  const { data } = supabase.storage.from("board_image").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
