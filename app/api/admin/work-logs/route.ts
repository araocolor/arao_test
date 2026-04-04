import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncProfile } from "@/lib/profiles";

type WorkLogStatus = "draft" | "done" | "rollback";

type WorkLogRow = {
  id: string;
  commit_hash: string;
  title: string;
  summary: string;
  details: string | null;
  status: WorkLogStatus;
  report_url: string | null;
  deployed_at: string | null;
  author_profile_id: string | null;
  author_name_snapshot: string;
  created_at: string;
  updated_at: string;
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

function normalizeStatus(input: unknown): WorkLogStatus | "all" {
  if (input === "draft" || input === "done" || input === "rollback" || input === "all") return input;
  return "all";
}

function normalizeLimit(input: string | null): number {
  const n = Number(input ?? "40");
  if (!Number.isFinite(n) || n <= 0) return 40;
  return Math.min(Math.floor(n), 200);
}

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = normalizeStatus(url.searchParams.get("status"));
  const limit = normalizeLimit(url.searchParams.get("limit"));

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("work_logs")
    .select(
      "id, commit_hash, title, summary, details, status, report_url, deployed_at, author_profile_id, author_name_snapshot, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  if (q) {
    const escaped = q.replace(/,/g, " ");
    query = query.or(
      `commit_hash.ilike.%${escaped}%,title.ilike.%${escaped}%,summary.ilike.%${escaped}%,author_name_snapshot.ilike.%${escaped}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("GET /api/admin/work-logs error:", error);
    return NextResponse.json({ message: "Failed to load work logs" }, { status: 500 });
  }

  return NextResponse.json({ items: (data ?? []) as WorkLogRow[] });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;

  try {
    const body = (await request.json()) as {
      commitHash?: string;
      title?: string;
      summary?: string;
      details?: string | null;
      status?: WorkLogStatus;
      reportUrl?: string | null;
      deployedAt?: string | null;
    };

    const commitHash = (body.commitHash ?? "").trim();
    const title = (body.title ?? "").trim();
    const summary = (body.summary ?? "").trim();
    const details = typeof body.details === "string" ? body.details.trim() : null;
    const status: WorkLogStatus =
      body.status === "draft" || body.status === "rollback" || body.status === "done"
        ? body.status
        : "done";
    const reportUrl = typeof body.reportUrl === "string" && body.reportUrl.trim() ? body.reportUrl.trim() : null;
    const deployedAt = typeof body.deployedAt === "string" && body.deployedAt.trim() ? body.deployedAt.trim() : null;

    if (!commitHash || !title) {
      return NextResponse.json({ message: "commitHash and title are required" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const payload = {
      commit_hash: commitHash,
      title,
      summary,
      details,
      status,
      report_url: reportUrl,
      deployed_at: deployedAt,
      author_profile_id: admin.profile.id,
      author_name_snapshot: admin.profile.username ?? admin.profile.full_name ?? admin.profile.email,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("work_logs")
      .upsert(payload, { onConflict: "commit_hash", ignoreDuplicates: false })
      .select(
        "id, commit_hash, title, summary, details, status, report_url, deployed_at, author_profile_id, author_name_snapshot, created_at, updated_at"
      )
      .single();

    if (error) {
      console.error("POST /api/admin/work-logs error:", error);
      return NextResponse.json({ message: "Failed to save work log" }, { status: 500 });
    }

    return NextResponse.json({ item: data as WorkLogRow });
  } catch (error) {
    console.error("POST /api/admin/work-logs parse error:", error);
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
}
