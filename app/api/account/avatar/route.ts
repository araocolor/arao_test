import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncProfile } from "@/lib/profiles";

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif"];

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;
  const profile = await syncProfile({ email, fullName });

  if (!profile) {
    return NextResponse.json(
      { message: "회원 정보를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("avatar-file") as File;

    if (!file || file.size === 0) {
      return NextResponse.json(
        { message: "파일을 선택해주세요." },
        { status: 400 }
      );
    }

    // 파일 타입 검증
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { message: "jpg, png, gif 파일만 업로드 가능합니다." },
        { status: 400 }
      );
    }

    // 파일 크기 검증
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: "파일 크기는 1MB 이내여야 합니다." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 데이터베이스에 저장
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("profiles")
      .update({ icon_image: buffer })
      .eq("id", profile.id);

    if (error) {
      return NextResponse.json(
        { message: "아이콘 저장 중 오류가 발생했습니다." },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "아이콘이 저장되었습니다." });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return NextResponse.json(
      { message: "파일 업로드 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

