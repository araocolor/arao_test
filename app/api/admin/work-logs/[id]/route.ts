import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncProfile } from "@/lib/profiles";

type WorkLogStatus = "draft" | "done" | "rollback";

type UpdateBody = {
  commitHash?: string;
  title?: string;
  summary?: string;
  details?: string | null;
  originalReview?: string | null;
  status?: WorkLogStatus;
  reportUrl?: string | null;
  deployedAt?: string | null;
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;

  const { id } = await params;
  try {
    const body = (await request.json()) as UpdateBody;
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.commitHash !== undefined) {
      const commitHash = body.commitHash.trim();
      if (!commitHash) {
        return NextResponse.json({ message: "commitHash cannot be empty" }, { status: 400 });
      }
      updateData.commit_hash = commitHash;
    }
    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) {
        return NextResponse.json({ message: "title cannot be empty" }, { status: 400 });
      }
      updateData.title = title;
    }
    if (body.summary !== undefined) updateData.summary = body.summary.trim();
    if (body.details !== undefined) updateData.details = typeof body.details === "string" ? body.details.trim() : null;
    if (body.originalReview !== undefined) {
      updateData.original_review =
        typeof body.originalReview === "string" ? body.originalReview.trim() : null;
    }
    if (body.status !== undefined) {
      if (body.status !== "draft" && body.status !== "done" && body.status !== "rollback") {
        return NextResponse.json({ message: "invalid status" }, { status: 400 });
      }
      updateData.status = body.status;
    }
    if (body.reportUrl !== undefined) {
      updateData.report_url = typeof body.reportUrl === "string" && body.reportUrl.trim() ? body.reportUrl.trim() : null;
    }
    if (body.deployedAt !== undefined) {
      updateData.deployed_at = typeof body.deployedAt === "string" && body.deployedAt.trim() ? body.deployedAt.trim() : null;
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("work_logs")
      .update(updateData)
      .eq("id", id)
      .select(
        "id, commit_hash, title, summary, details, original_review, status, report_url, deployed_at, author_profile_id, author_name_snapshot, created_at, updated_at"
      )
      .single();

    if (error) {
      console.error("PATCH /api/admin/work-logs/[id] error:", error);
      return NextResponse.json({ message: "Failed to update work log" }, { status: 500 });
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    console.error("PATCH /api/admin/work-logs/[id] parse error:", error);
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ message: "id is required" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("work_logs").delete().eq("id", id);

  if (error) {
    console.error("DELETE /api/admin/work-logs/[id] error:", error);
    return NextResponse.json({ message: "Failed to delete work log" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
