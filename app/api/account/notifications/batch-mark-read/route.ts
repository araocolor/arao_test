import { auth } from "@clerk/nextjs/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json() as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids : [];

    if (ids.length === 0) {
      return NextResponse.json({ success: true });
    }

    const supabase = createSupabaseAdminClient();

    // 현재 사용자의 프로필 확인
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // 해당 프로필의 알림만 읽음 처리
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("profile_id", profile.id)
      .in("id", ids);

    if (error) {
      console.error("batch-mark-read error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/account/notifications/batch-mark-read error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
