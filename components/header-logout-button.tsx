"use client";

import { useClerk, useUser } from "@clerk/nextjs";

export function HeaderLogoutButton() {
  const { isSignedIn } = useUser();
  const { signOut } = useClerk();

  if (!isSignedIn) return null;

  return (
    <button
      className="header-logout-button"
      type="button"
      onClick={() => void signOut({ redirectUrl: "/" })}
    >
      Logout
    </button>
  );
}
