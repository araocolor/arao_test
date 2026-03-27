import { auth, currentUser } from "@clerk/nextjs/server";
import { getUnreadInquiryCount } from "@/lib/consulting";
import { syncProfile } from "@/lib/profiles";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ unreadCount: 0 });
    }

    const user = await currentUser();
    if (!user?.emailAddresses?.[0]?.emailAddress) {
      return NextResponse.json({ unreadCount: 0 });
    }

    const profile = await syncProfile({
      email: user.emailAddresses[0].emailAddress,
      fullName: user.fullName,
    });

    if (!profile) {
      return NextResponse.json({ unreadCount: 0 });
    }

    const unreadCount = await getUnreadInquiryCount(profile.id);

    return NextResponse.json({ unreadCount });
  } catch (error) {
    console.error("GET /api/account/notifications error:", error);
    return NextResponse.json({ unreadCount: 0 });
  }
}
