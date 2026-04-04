import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncProfile } from "@/lib/profiles";

type WorkLogMemoRow = {
  id: string;
  work_log_id: string;
  memo: string;
  created_by_profile_id: string | null;
  created_by_name_snapshot: string;
  created_at: string;
};

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) {
    return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;
  const profile = await syncProfile({ email, fullName });
  if (!profile || profile.role !== "admin") {
    return { error: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
  }

  return { profile };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;

  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("work_log_memos")
    .select("id, work_log_id, memo, created_by_profile_id, created_by_name_snapshot, created_at")
    .eq("work_log_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GET /api/admin/work-logs/[id]/memos error:", error);
    return NextResponse.json({ message: "Failed to load memos" }, { status: 500 });
  }

  return NextResponse.json({ items: (data ?? []) as WorkLogMemoRow[] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;

  const { id } = await params;
  try {
    const body = (await request.json()) as { memo?: string };
    const memo = (body.memo ?? "").trim();
    if (!memo) {
      return NextResponse.json({ message: "memo is required" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const payload = {
      work_log_id: id,
      memo,
      created_by_profile_id: admin.profile.id,
      created_by_name_snapshot: admin.profile.username ?? admin.profile.full_name ?? admin.profile.email,
    };

    const { data, error } = await supabase
      .from("work_log_memos")
      .insert(payload)
      .select("id, work_log_id, memo, created_by_profile_id, created_by_name_snapshot, created_at")
      .single();

    if (error) {
      console.error("POST /api/admin/work-logs/[id]/memos error:", error);
      return NextResponse.json({ message: "Failed to save memo" }, { status: 500 });
    }

    return NextResponse.json({ item: data as WorkLogMemoRow });
  } catch (error) {
    console.error("POST /api/admin/work-logs/[id]/memos parse error:", error);
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
}
