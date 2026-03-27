import { auth, currentUser } from "@clerk/nextjs/server";
import {
  getInquiryById,
  updateInquiryStatus,
} from "@/lib/consulting";
import { syncProfile } from "@/lib/profiles";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    if (!profile) {
      return NextResponse.json(
        { message: "Profile not found" },
        { status: 404 }
      );
    }

    const { id } = await params;
    const result = await getInquiryById(id);

    if (!result) {
      return NextResponse.json(
        { message: "Inquiry not found" },
        { status: 404 }
      );
    }

    // 권한 확인: 본인 것만 조회 가능
    if (result.inquiry.profile_id !== profile.id) {
      return NextResponse.json(
        { message: "Forbidden" },
        { status: 403 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/account/consulting/[id] error:", error);
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

    if (!profile) {
      return NextResponse.json(
        { message: "Profile not found" },
        { status: 404 }
      );
    }

    const { id } = await params;
    const body = await request.json() as { action?: string };

    if (body.action !== "close") {
      return NextResponse.json(
        { message: "Invalid action" },
        { status: 400 }
      );
    }

    const result = await getInquiryById(id);
    if (!result) {
      return NextResponse.json(
        { message: "Inquiry not found" },
        { status: 404 }
      );
    }

    // 권한 확인
    if (result.inquiry.profile_id !== profile.id) {
      return NextResponse.json(
        { message: "Forbidden" },
        { status: 403 }
      );
    }

    const updated = await updateInquiryStatus(id, "closed");

    if (!updated) {
      return NextResponse.json(
        { message: "Failed to update inquiry" },
        { status: 500 }
      );
    }

    return NextResponse.json({ inquiry: updated });
  } catch (error) {
    console.error("PATCH /api/account/consulting/[id] error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
