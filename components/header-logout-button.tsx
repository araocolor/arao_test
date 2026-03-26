"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import Link from "next/link";

export function HeaderLogoutButton() {
  const { isSignedIn } = useUser();
  const { signOut } = useClerk();

  return isSignedIn ? (
    <button
      className="header-logout-button"
      type="button"
      onClick={() => void signOut({ redirectUrl: "/" })}
    >
      로그아웃
    </button>
  ) : (
    <Link className="header-logout-button" href="/sign-in">
      로그인
    </Link>
  );
}
