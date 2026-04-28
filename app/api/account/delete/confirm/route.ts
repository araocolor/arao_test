import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncProfile } from "@/lib/profiles";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { code?: string };
  const code = (body.code ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ message: "인증번호 6자리를 입력하세요." }, { status: 400 });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  if (!email) {
    return NextResponse.json({ message: "이메일을 찾을 수 없습니다." }, { status: 400 });
  }

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;
  const profile = await syncProfile({ email, fullName });
  if (!profile) {
    return NextResponse.json({ message: "회원 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  if (profile.role === "admin") {
    return NextResponse.json({ message: "관리자는 탈퇴할 수 없습니다." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const codeHash = createHash("sha256").update(code).digest("hex");

  const { data: codeRow, error: codeError } = await supabase
    .from("account_delete_codes")
    .select("id, code_hash, attempts, expires_at")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (codeError || !codeRow) {
    return NextResponse.json({ message: "인증번호가 발급되지 않았습니다. 다시 요청해주세요." }, { status: 400 });
  }

  if (new Date(codeRow.expires_at).getTime() < Date.now()) {
    await supabase.from("account_delete_codes").delete().eq("id", codeRow.id);
    return NextResponse.json({ message: "인증번호가 만료되었습니다. 다시 요청해주세요." }, { status: 400 });
  }

  if (codeRow.attempts >= 5) {
    await supabase.from("account_delete_codes").delete().eq("id", codeRow.id);
    return NextResponse.json({ message: "인증 시도 횟수를 초과했습니다. 다시 요청해주세요." }, { status: 400 });
  }

  if (codeRow.code_hash !== codeHash) {
    await supabase
      .from("account_delete_codes")
      .update({ attempts: codeRow.attempts + 1 })
      .eq("id", codeRow.id);
    return NextResponse.json({ message: "인증번호가 일치하지 않습니다." }, { status: 400 });
  }

  const now = new Date();
  const scheduled = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      deleted_at: now.toISOString(),
      delete_scheduled_at: scheduled.toISOString(),
      previous_username: profile.username,
      username: null,
      phone: null,
      icon_image: null,
      full_name: null,
    })
    .eq("id", profile.id);

  if (updateError) {
    return NextResponse.json({ message: "탈퇴 처리 중 오류가 발생했습니다." }, { status: 500 });
  }

  await supabase.from("colors").delete().eq("profile_id", profile.id);
  await supabase.from("user_reviews").delete().eq("profile_id", profile.id);
  await supabase.from("reviews").delete().eq("profile_id", profile.id);

  await supabase.from("account_delete_codes").delete().eq("id", codeRow.id);

  try {
    const client = await clerkClient();
    await client.users.deleteUser(userId);
  } catch (e) {
    // Clerk 삭제 실패해도 Supabase 탈퇴는 이미 처리됨. 로그만 남김.
    console.error("[account-delete] Clerk user delete failed", e);
  }

  return NextResponse.json({ ok: true });
}
