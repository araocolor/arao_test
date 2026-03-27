import { auth, currentUser } from "@clerk/nextjs/server";
import {
  getInquiriesByProfile,
  createInquiry,
  type Inquiry,
} from "@/lib/consulting";
import { syncProfile } from "@/lib/profiles";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
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

    const url = new URL(request.url);
    const type = url.searchParams.get("type") as
      | "consulting"
      | "general"
      | null;
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const limit = parseInt(url.searchParams.get("limit") ?? "10");

    const result = await getInquiriesByProfile(profile.id, type ?? undefined, page, limit);

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/account/consulting error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();
    const { type, title, content } = body as {
      type: "consulting" | "general";
      title: string;
      content: string;
    };

    if (!type || !title || !content) {
      return NextResponse.json(
        { message: "Missing required fields: type, title, content" },
        { status: 400 }
      );
    }

    const inquiry = await createInquiry(profile.id, type, title, content);

    if (!inquiry) {
      return NextResponse.json(
        { message: "Failed to create inquiry" },
        { status: 500 }
      );
    }

    return NextResponse.json({ inquiry }, { status: 201 });
  } catch (error) {
    console.error("POST /api/account/consulting error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
