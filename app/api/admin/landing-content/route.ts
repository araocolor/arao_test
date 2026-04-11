export const maxDuration = 60;

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getLandingContent, saveLandingContent, type LandingContent } from "@/lib/landing-content";
import { syncProfile } from "@/lib/profiles";

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

export async function GET() {
  const admin = await requireAdmin();

  if ("error" in admin) {
    return admin.error;
  }

  const content = await getLandingContent();
  return NextResponse.json(content);
}

export async function PUT(request: Request) {
  const admin = await requireAdmin();

  if ("error" in admin) {
    return admin.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const skipGallery = searchParams.get("skipGallery") === "true";
    const body = (await request.json()) as LandingContent;
    const content = await saveLandingContent(body, { skipGallery });
    return NextResponse.json(content);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Failed to save landing content" }, { status: 500 });
  }
}
