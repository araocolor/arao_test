"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { User } from "lucide-react";
import { clearAllCachesOnLogout } from "@/hooks/use-prefetch-cache";

export function HeaderLogoutButton() {
  const { isSignedIn } = useUser();
  const { signOut } = useClerk();

  if (!isSignedIn) {
    return (
      <Link className="header-menu-label" href="/sign-in">
        <span aria-hidden="true">
          <User width={18} height={18} strokeWidth={1.8} />
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
