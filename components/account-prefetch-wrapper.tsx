"use client";

import { ReactNode } from "react";
import { useAccountPrefetch } from "@/hooks/use-account-prefetch";
import { useInactivityLogout } from "@/hooks/use-inactivity-logout";
import { useGalleryPrefetch } from "@/hooks/use-gallery-prefetch";

export function AccountPrefetchWrapper({ children }: { children: ReactNode }) {
  useAccountPrefetch();
  useInactivityLogout();
  useGalleryPrefetch();

  return <>{children}</>;
}
