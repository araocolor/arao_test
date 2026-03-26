"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import Link from "next/link";

export function HeaderLogoutButton() {
  const { isSignedIn } = useUser();
  const { signOut } = useClerk();

  if (!isSignedIn) {
    return (
      <Link className="header-menu-label" href="/sign-in">
        login
      </Link>
    );
  }

  return (
    <button
      className="header-menu-label"
      type="button"
      onClick={() => void signOut({ redirectUrl: "/" })}
    >
      logout
    </button>
  );
}
