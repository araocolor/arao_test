"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useNotificationCount } from "@/hooks/use-notification-count";
import { useAdminPendingCount } from "@/hooks/use-admin-pending-count";

export function HeaderProfileLink() {
  const { isSignedIn } = useUser();
  const unreadCount = useNotificationCount(isSignedIn ?? false);
  const pendingCount = useAdminPendingCount(isSignedIn ?? false);

  // 관리자면 pending count, 아니면 unread count
  const badgeCount = pendingCount > 0 ? pendingCount : unreadCount;

  return (
    <Link aria-label="사용자 프로필" className={`header-profile-link ${isSignedIn ? "signed-in" : ""}`} href={isSignedIn ? "/account" : "/sign-in"}>
      <span className="header-profile-icon" aria-hidden="true">
        <span className="header-profile-head" />
        <span className="header-profile-body" />
      </span>
      {isSignedIn && badgeCount > 0 && (
        <span className="header-profile-badge">{badgeCount}</span>
      )}
    </Link>
  );
}
