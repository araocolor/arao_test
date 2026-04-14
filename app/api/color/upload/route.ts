import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const IMAGE_CACHE_CONTROL = "31536000";
const BUCKET = "board_image";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const formData = await request.formData();
  const supabase = createSupabaseAdminClient();
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
            .from(BUCKET)
            .upload(path, buffer, {
              contentType: file.type || "image/jpeg",
              cacheControl: IMAGE_CACHE_CONTROL,
              upsert: false,
            });
          if (error) { console.error(`upload error [${key}]:`, error); return; }
          const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
          results[formData.get(`key_${idx}`) as string] = data.publicUrl;
        })
      );
    }
    i++;
  }

  await Promise.all(uploads);
  return NextResponse.json({ urls: results });
}
