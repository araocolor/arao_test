"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { clearAllCachesOnLogout } from "@/hooks/use-prefetch-cache";

export function HeaderLogoutButton() {
  const { isSignedIn } = useUser();
  const { signOut } = useClerk();

  if (!isSignedIn) {
    return (
      <Link className="header-menu-label" href="/sign-in">
        <span className="header-login-avatar-fallback" aria-hidden="true">
          <UserRound className="header-login-avatar-fallback-icon" width={20} height={20} strokeWidth={1.8} />
        </span>
        로그인
      </Link>
    );
  }

  return (
    <button
      className="header-menu-label"
      type="button"
      onClick={() => {
        clearAllCachesOnLogout();
        void signOut().then(() => { window.location.href = "/"; });
      }}
    >
      로그아웃
    </button>
  );
}
