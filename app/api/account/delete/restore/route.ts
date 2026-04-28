import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncProfile } from "@/lib/profiles";

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

  if (!profile.deleted_at) {
    return NextResponse.json({ message: "탈퇴 상태가 아닙니다." }, { status: 400 });
  }

  if (profile.delete_scheduled_at && new Date(profile.delete_scheduled_at).getTime() < Date.now()) {
    return NextResponse.json({ message: "복구 기간이 만료되었습니다." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      deleted_at: null,
      delete_scheduled_at: null,
      previous_username: null,
    })
    .eq("id", profile.id);

  if (error) {
    return NextResponse.json({ message: "복구 처리 중 오류가 발생했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
