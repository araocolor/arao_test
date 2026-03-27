import { auth, currentUser } from "@clerk/nextjs/server";
import { getAllInquiries } from "@/lib/consulting";
import { syncProfile } from "@/lib/profiles";
import { NextResponse } from "next/server";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await currentUser();
  if (!user?.emailAddresses?.[0]?.emailAddress) {
    return { error: "User email not found", status: 400 };
  }

  const profile = await syncProfile({
    email: user.emailAddresses[0].emailAddress,
    fullName: user.fullName,
  });

  if (!profile || profile.role !== "admin") {
    return { error: "Admin access required", status: 403 };
  }

  return { profile };
}

export async function GET(request: Request) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck) {
      return NextResponse.json(
        { message: adminCheck.error },
        { status: adminCheck.status }
      );
    }

    const url = new URL(request.url);
    const type = url.searchParams.get("type") as
      | "consulting"
      | "general"
      | null;
    const status = url.searchParams.get("status");
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const limit = parseInt(url.searchParams.get("limit") ?? "20");

    const result = await getAllInquiries(
      type ?? undefined,
      status ?? undefined,
      page,
      limit
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/admin/consulting error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
