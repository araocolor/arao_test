import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const AVATAR_BUCKET = process.env.SUPABASE_AVATAR_BUCKET || "board_image";
const RANDOM_AVATAR_FOLDER = "random-avatars";
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_BYTES) return null;
  return { mimeType, buffer };
}

function getExt(mimeType: string): string {
  switch (mimeType) {
    case "image/png": return "png";
    case "image/gif": return "gif";
    case "image/webp": return "webp";
    default: return "jpg";
  }
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseAdminClient();

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  if (!email) return NextResponse.json({ message: "이메일 정보가 없습니다." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("email", email.toLowerCase()).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });

  const { data, error } = await supabase
    .from("random_avatars")
    .select("url")
    .order("id", { ascending: true });

  if (error) return NextResponse.json({ message: "목록 조회 실패" }, { status: 500 });

  return NextResponse.json({ avatars: data ?? [] });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  if (!email) return NextResponse.json({ message: "이메일 정보가 없습니다." }, { status: 401 });

  const supabase = createSupabaseAdminClient();

  const { data: profile } = await supabase.from("profiles").select("role").eq("email", email.toLowerCase()).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });

  const body = (await request.json()) as { dataUrl?: string; index?: number };
  if (!body.dataUrl || !body.dataUrl.startsWith("data:image/")) {
    return NextResponse.json({ message: "유효한 이미지 데이터가 없습니다." }, { status: 400 });
  }

  const parsed = parseDataUrl(body.dataUrl);
  if (!parsed) return NextResponse.json({ message: "이미지 형식이 올바르지 않습니다." }, { status: 400 });

  const name = `random_${crypto.randomUUID()}.${getExt(parsed.mimeType)}`;
  const path = `${RANDOM_AVATAR_FOLDER}/${name}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, parsed.buffer, {
      contentType: parsed.mimeType,
      cacheControl: "60",
      upsert: true,
    });

  if (uploadError) return NextResponse.json({ message: "업로드 실패: " + uploadError.message }, { status: 500 });

  const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const url = urlData.publicUrl;

  const { error: dbError } = await supabase
    .from("random_avatars")
    .insert({ url });

  if (dbError) {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    return NextResponse.json({ message: "DB 저장 실패: " + dbError.message }, { status: 500 });
  }

  return NextResponse.json({ message: "업로드 완료", url });
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  if (!email) return NextResponse.json({ message: "이메일 정보가 없습니다." }, { status: 401 });

  const supabase = createSupabaseAdminClient();

  const { data: profile } = await supabase.from("profiles").select("role").eq("email", email.toLowerCase()).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });

  const body = (await request.json()) as { url?: string };
  if (!body.url) return NextResponse.json({ message: "url이 필요합니다." }, { status: 400 });

  const storagePath = getStoragePathFromPublicUrl(body.url);
  if (storagePath) {
    await supabase.storage.from(AVATAR_BUCKET).remove([storagePath]);
  }

  const { error: deleteError } = await supabase
    .from("random_avatars")
    .delete()
    .eq("url", body.url);

  if (deleteError) return NextResponse.json({ message: "삭제 실패: " + deleteError.message }, { status: 500 });

  return NextResponse.json({ message: "삭제 완료" });
}

function getStoragePathFromPublicUrl(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl);
    const pathParts = url.pathname.split("/");
    const bucketIndex = pathParts.findIndex((p) => p === AVATAR_BUCKET);
    if (bucketIndex === -1) return null;
    return pathParts.slice(bucketIndex + 1).join("/");
  } catch {
    return null;
  }
}
