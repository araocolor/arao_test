import { auth, currentUser } from "@clerk/nextjs/server";
import {
  getInquiryByIdAdmin,
  createReply,
  updateInquiryStatus,
} from "@/lib/consulting";
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck) {
      return NextResponse.json(
        { message: adminCheck.error },
        { status: adminCheck.status }
      );
    }

    const { id } = await params;
    const result = await getInquiryByIdAdmin(id);

    if (!result) {
      return NextResponse.json(
        { message: "Inquiry not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/admin/consulting/[id] error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck) {
      return NextResponse.json(
        { message: adminCheck.error },
        { status: adminCheck.status }
      );
    }

    const { id } = await params;
    const body = await request.json() as { content?: string };

    if (!body.content) {
      return NextResponse.json(
        { message: "Content is required" },
        { status: 400 }
      );
    }

    const reply = await createReply(id, body.content);

    if (!reply) {
      return NextResponse.json(
        { message: "Failed to create reply" },
        { status: 500 }
      );
    }

    return NextResponse.json({ reply }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/consulting/[id] error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck) {
      return NextResponse.json(
        { message: adminCheck.error },
        { status: adminCheck.status }
      );
    }

    const { id } = await params;
    const body = await request.json() as { status?: string };

    if (
      !body.status ||
      !["pending", "in_progress", "resolved", "closed"].includes(body.status)
    ) {
      return NextResponse.json(
        { message: "Invalid status" },
        { status: 400 }
      );
    }

    const updated = await updateInquiryStatus(
      id,
      body.status as "pending" | "in_progress" | "resolved" | "closed"
    );

    if (!updated) {
      return NextResponse.json(
        { message: "Failed to update inquiry" },
        { status: 500 }
      );
    }

    return NextResponse.json({ inquiry: updated });
  } catch (error) {
    console.error("PATCH /api/admin/consulting/[id] error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
