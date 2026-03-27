import { auth, currentUser } from "@clerk/nextjs/server";
import { syncProfile } from "@/lib/profiles";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await currentUser();
    if (!user?.emailAddresses?.[0]?.emailAddress) {
      return NextResponse.json(
        { message: "User email not found" },
        { status: 400 }
      );
    }

    const profile = await syncProfile({
      email: user.emailAddresses[0].emailAddress,
      fullName: user.fullName,
    });

    if (!profile || profile.role !== "admin") {
      return NextResponse.json(
        { message: "Admin access required" },
        { status: 403 }
      );
    }

    // 답변대기중(pending) 상태의 글 개수
    const supabase = createSupabaseAdminClient();
    const { count, error } = await supabase
      .from("inquiries")
      .select("*", { count: "exact" })
      .eq("status", "pending");

    if (error) {
      console.error("Failed to count pending inquiries:", error);
      return NextResponse.json(
        { message: "Internal server error" },
        { status: 500 }
      );
    }

    return NextResponse.json({ pendingCount: count ?? 0 });
  } catch (error) {
    console.error("GET /api/admin/consulting/pending-count error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
