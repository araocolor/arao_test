import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncProfile } from "@/lib/profiles";
import { getWithdrawRestrictionDaysLeft, isWithdrawRestricted } from "@/lib/account-delete-policy";
import { sendDeleteVerificationEmail } from "@/lib/mail/send-delete-code";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
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

  if (profile.deleted_at) {
    return NextResponse.json({ message: "이미 탈퇴 진행 중입니다." }, { status: 400 });
  }

  if (profile.role === "admin") {
    return NextResponse.json({ message: "관리자는 탈퇴할 수 없습니다." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: restrictionRow, error: restrictionError } = await supabase
    .from("profiles")
    .select("withdraw_restricted_until")
    .eq("id", profile.id)
    .maybeSingle<{ withdraw_restricted_until: string | null }>();

  if (restrictionError && restrictionError.code !== "42703") {
    return NextResponse.json({ message: "회원 상태 확인 중 오류가 발생했습니다." }, { status: 500 });
  }

  const withdrawRestrictedUntil = restrictionError?.code === "42703"
    ? null
    : (restrictionRow?.withdraw_restricted_until ?? null);

  if (isWithdrawRestricted(withdrawRestrictedUntil)) {
    const daysLeft = getWithdrawRestrictionDaysLeft(withdrawRestrictedUntil);
    return NextResponse.json(
      { message: `복구한 계정은 14일 이후에 탈퇴 신청이 가능합니다. (${daysLeft}일 남음)` },
      { status: 400 },
    );
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = createHash("sha256").update(code).digest("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await supabase.from("account_delete_codes").delete().eq("profile_id", profile.id);

  const { error: insertError } = await supabase.from("account_delete_codes").insert({
    profile_id: profile.id,
    email,
    code_hash: codeHash,
    expires_at: expiresAt,
  });

  if (insertError) {
    return NextResponse.json({ message: "인증번호 생성 중 오류가 발생했습니다." }, { status: 500 });
  }

  const sendResult = await sendDeleteVerificationEmail(email, code);
  if (!sendResult.ok) {
    await supabase.from("account_delete_codes").delete().eq("profile_id", profile.id);
    return NextResponse.json({ message: sendResult.message ?? "메일 발송 실패" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
