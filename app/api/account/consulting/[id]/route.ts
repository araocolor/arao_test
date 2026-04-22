import { auth, currentUser } from "@clerk/nextjs/server";
import {
  getInquiryById,
  updateInquiry,
  deleteInquiry,
  createFollowupInquiryByCustomer,
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
    const body = await request.json() as { action?: string; title?: string; content?: string };

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

    // delete 액션 (close는 하위 호환)
    if (body.action === "delete" || body.action === "close") {
      const deleted = await deleteInquiry(id);
      if (!deleted) {
        return NextResponse.json(
          { message: "Failed to delete inquiry" },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true });
    }

    // edit 액션
    if (body.action === "edit") {
      if (!body.title?.trim() || !body.content?.trim()) {
        return NextResponse.json(
          { message: "Title and content are required" },
          { status: 400 }
        );
      }

      const updated = await updateInquiry(id, body.title, body.content);
      if (!updated) {
        return NextResponse.json(
          { message: "Failed to update inquiry" },
          { status: 500 }
        );
      }
      return NextResponse.json({ inquiry: updated });
    }

    // followup 액션: 답변완료 글에 추가문의 등록
    if (body.action === "followup") {
      if (!body.content?.trim()) {
        return NextResponse.json(
          { message: "Content is required" },
          { status: 400 }
        );
      }

      const currentStatus = result.inquiry.status as string;
      if (currentStatus !== "resolved" && currentStatus !== "closed") {
        return NextResponse.json(
          { message: "추가문의는 답변완료 상태에서만 가능합니다." },
          { status: 400 }
        );
      }

      const created = await createFollowupInquiryByCustomer(id, body.content.trim());
      if (!created) {
        return NextResponse.json(
          { message: "Failed to create followup inquiry" },
          { status: 500 }
        );
      }

      return NextResponse.json(created);
    }

    return NextResponse.json(
      { message: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("PATCH /api/account/consulting/[id] error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
