"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { clearAllCachesOnLogout } from "@/hooks/use-prefetch-cache";

export function HeaderLogoutButton() {
  const { isSignedIn } = useUser();
  const { signOut } = useClerk();

  if (!isSignedIn) {
    return (
      <Link className="header-menu-label" href="/sign-in">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <polyline points="10 17 15 12 10 7" />
          <line x1="15" y1="12" x2="3" y2="12" />
        </svg>
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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      로그아웃
    </button>
  );
}
