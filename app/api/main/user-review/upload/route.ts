import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const formData = await request.formData();
  const supabase = createSupabaseAdminClient();

  // formData에서 모든 파일+경로 쌍 추출
  const results: Record<string, string> = {};
  const uploads: Promise<void>[] = [];

  let i = 0;
  while (formData.has(`file_${i}`)) {
    const file = formData.get(`file_${i}`) as File | null;
    const path = formData.get(`path_${i}`) as string | null;
    const key = formData.get(`key_${i}`) as string | null;

    if (file && path && key) {
      const idx = i;
      uploads.push(
        file.arrayBuffer().then(async (ab) => {
          const buffer = Buffer.from(ab);
          const { error } = await supabase.storage
            .from("board_image")
            .upload(path, buffer, { contentType: "image/jpeg", upsert: true });

          if (error) {
            console.error(`Storage upload error [${key}]:`, error);
            return;
          }
          const { data } = supabase.storage.from("board_image").getPublicUrl(path);
          results[formData.get(`key_${idx}`) as string] = data.publicUrl;
        })
      );
    }
    i++;
  }

  await Promise.all(uploads);
  return NextResponse.json({ urls: results });
}
