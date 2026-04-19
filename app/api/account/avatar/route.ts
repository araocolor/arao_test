import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncProfile } from "@/lib/profiles";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ iconImage: null }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;
  const profile = await syncProfile({ email, fullName });

  return NextResponse.json(
    {
      iconImage: profile?.icon_image ?? null,
      username: profile?.username ?? null,
      tier: profile?.tier ?? "general",
      role: profile?.role ?? "member",
    },
    { headers: { "Cache-Control": "private, max-age=60" } }
  );
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;
  const profile = await syncProfile({ email, fullName });

  if (!profile) {
    return NextResponse.json({ message: "회원 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    const body = (await request.json()) as { dataUrl?: string };

    if (!body.dataUrl || !body.dataUrl.startsWith("data:image/")) {
      return NextResponse.json({ message: "유효한 이미지 데이터가 없습니다." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("profiles")
      .update({ icon_image: body.dataUrl })
      .eq("id", profile.id);

    if (error) {
      console.error("Avatar save error:", error);
      return NextResponse.json({ message: "아이콘 저장 중 오류가 발생했습니다." }, { status: 400 });
    }

    return NextResponse.json({ message: "아이콘이 저장되었습니다." });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return NextResponse.json({ message: "파일 업로드 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function DELETE() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;
  const profile = await syncProfile({ email, fullName });

  if (!profile) {
    return NextResponse.json({ message: "회원 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("profiles")
      .update({ icon_image: null })
      .eq("id", profile.id);

    if (error) {
      console.error("Avatar delete error:", error);
      return NextResponse.json({ message: "아이콘 삭제 중 오류가 발생했습니다." }, { status: 400 });
    }

    return NextResponse.json({ message: "아이콘이 삭제되었습니다.", iconImage: null });
  } catch (error) {
    console.error("Avatar delete error:", error);
    return NextResponse.json({ message: "아이콘 삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
