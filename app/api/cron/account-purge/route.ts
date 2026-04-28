import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: targets, error } = await supabase
    .from("profiles")
    .select("id, email")
    .lt("delete_scheduled_at", now)
    .not("deleted_at", "is", null);

  if (error) {
    return NextResponse.json({ message: "조회 실패", error: error.message }, { status: 500 });
  }

  const targetList = targets ?? [];
  const purged: string[] = [];
  const failed: { email: string; reason: string }[] = [];

  for (const target of targetList) {
    try {
      await supabase.from("profiles").delete().eq("id", target.id);
      purged.push(target.email);
    } catch (e) {
      failed.push({ email: target.email, reason: e instanceof Error ? e.message : "unknown" });
    }
  }

  return NextResponse.json({
    purgedCount: purged.length,
    purged,
    failed,
  });
}
