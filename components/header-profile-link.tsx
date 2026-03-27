"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useNotificationCount } from "@/hooks/use-notification-count";

export function HeaderProfileLink() {
  const { isSignedIn } = useUser();
  const unreadCount = useNotificationCount(isSignedIn ?? false);

  return (
    <Link aria-label="사용자 프로필" className={`header-profile-link ${isSignedIn ? "signed-in" : ""}`} href={isSignedIn ? "/account" : "/sign-in"}>
      <span className="header-profile-icon" aria-hidden="true">
        <span className="header-profile-head" />
        <span className="header-profile-body" />
      </span>
      {isSignedIn && unreadCount > 0 && (
        <span className="header-profile-badge">{unreadCount}</span>
      )}
    </Link>
  );
}
