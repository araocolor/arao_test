"use client";

import { type ReactNode, useEffect, useState } from "react";

type HomeEntryLoaderProps = {
  children: ReactNode;
};

function hasLandingCache(): boolean {
  try {
    return !!(
      sessionStorage.getItem("color-items") ||
      sessionStorage.getItem("color-list-cache") ||
      sessionStorage.getItem("user-review-list-cache-arao")
    );
  } catch {
    return false;
  }
}

export function HomeEntryLoader({ children }: HomeEntryLoaderProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (hasLandingCache()) {
      setReady(true);
      return;
    }
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <main className="landing-entry-loader" aria-label="로딩" />
    );
  }

  return <>{children}</>;
}
