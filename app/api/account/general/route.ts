import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashPassword, validateEnglishNumberPassword } from "@/lib/password";
import { syncProfile } from "@/lib/profiles";
import { isDesignMode, mockGeneralProfile } from "@/lib/design-mock";

export async function GET() {
  // 디자인 모드: Clerk 로그인 없이 더미 데이터 반환
  if (isDesignMode) {
    return NextResponse.json(mockGeneralProfile);
  }

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

  let iconImage: string | undefined;
  if ((profile as any).icon_image) {
    const buffer = (profile as any).icon_image as Buffer;
    iconImage = `data:image/jpeg;base64,${buffer.toString("base64")}`;
  }

  return NextResponse.json({
    email: profile.email,
    fullName: profile.full_name,
    username: profile.username,
    hasPassword: Boolean(profile.password_hash),
    phone: profile.phone,
    iconImage,
  });
}

function validateUsername(username: string) {
  const trimmedUsername = username.trim().toLowerCase();

  if (trimmedUsername.length < 3) {
    return { error: "아이디는 3자 이상이어야 합니다." };
  }

  if (!/^[a-z0-9._-]+$/.test(trimmedUsername)) {
    return { error: "아이디는 영문 소문자, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다." };
  }

  return { value: trimmedUsername };
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (!/^010\d{8}$/.test(digits)) {
    return { error: "연락처는 010으로 시작하는 11자리 번호를 입력해주세요." };
  }

  return { value: digits };
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

  const body = (await request.json()) as {
    action?: string;
    username?: string;
    password?: string;
    phone?: string;
  };
  const supabase = createSupabaseAdminClient();

  if (body.action === "username") {
    if (profile.username) {
      return NextResponse.json({ message: "이미 아이디가 등록되어 있습니다." }, { status: 400 });
    }

    const usernameResult = validateUsername(body.username ?? "");
    if ("error" in usernameResult) {
      return NextResponse.json({ message: usernameResult.error }, { status: 400 });
    }

    const { error } = await supabase
      .from("profiles")
      .update({ username: usernameResult.value })
      .eq("id", profile.id);

    if (error) {
      const message =
        error.code === "23505" ? "이미 사용 중인 아이디입니다." : "아이디 저장 중 오류가 발생했습니다.";
      return NextResponse.json({ message }, { status: 400 });
    }

    return NextResponse.json({ username: usernameResult.value });
  }

  if (body.action === "password") {
    const password = body.password ?? "";
    const passwordError = validateEnglishNumberPassword(password);

    if (passwordError) {
      return NextResponse.json({ message: passwordError }, { status: 400 });
    }

    const passwordHash = hashPassword(password.trim());
    const { error } = await supabase
      .from("profiles")
      .update({ password_hash: passwordHash })
      .eq("id", profile.id);

    if (error) {
      return NextResponse.json({ message: "비밀번호 저장 중 오류가 발생했습니다." }, { status: 400 });
    }

    return NextResponse.json({ hasPassword: true });
  }

  if (body.action === "phone") {
    const phoneResult = normalizePhone(body.phone ?? "");

    if ("error" in phoneResult) {
      return NextResponse.json({ message: phoneResult.error }, { status: 400 });
    }

    const { error } = await supabase
      .from("profiles")
      .update({ phone: phoneResult.value })
      .eq("id", profile.id);

    if (error) {
      return NextResponse.json({ message: "연락처 저장 중 오류가 발생했습니다." }, { status: 400 });
    }

    return NextResponse.json({ phone: phoneResult.value });
  }

  return NextResponse.json({ message: "지원하지 않는 요청입니다." }, { status: 400 });
}
