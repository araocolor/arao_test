import { auth, currentUser } from "@clerk/nextjs/server";
import { getNotificationsForProfile } from "@/lib/notifications";
import { syncProfile } from "@/lib/profiles";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ unreadCount: 0, items: [] });
    }

    const user = await currentUser();
    if (!user?.emailAddresses?.[0]?.emailAddress) {
      return NextResponse.json({ unreadCount: 0, items: [] });
    }

    const profile = await syncProfile({
      email: user.emailAddresses[0].emailAddress,
      fullName: user.fullName,
    });

    if (!profile) {
      return NextResponse.json({ unreadCount: 0, items: [] });
    }

    // 모든 알림 소스 집계 (settings, consulting, notifications 테이블)
    const { items, unreadCount } = await getNotificationsForProfile(profile.id, {
      username: profile.username,
      password_hash: profile.password_hash,
      phone: profile.phone,
    });

    return NextResponse.json({ unreadCount, items });
  } catch (error) {
    console.error("GET /api/account/notifications error:", error);
    return NextResponse.json({ unreadCount: 0, items: [] });
  }
}
