"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { LandingAuthControls, LandingAuthControlsCompact } from "@/components/landing-auth-controls";
import { HeaderProfileLink, HeaderDrawerAvatar } from "@/components/header-profile-link";
import { HeaderLogoutButton } from "@/components/header-logout-button";
import { SiteHeader } from "@/components/site-header";

const BASE_LINKS = [
  { href: "/about", label: "ARAO 소개" },
  { href: "/gallery", label: "갤러리" },
  { href: "/user_review", label: "커뮤니티" },
  { href: "/manual", label: "설치방법" },
  { href: "/pricing", label: "구매가이드" },
  { href: "/color", label: "컬러레시피" },
  { href: "/account/general", label: "사용자설정" },
] as const;

type LandingPageHeaderProps = {
  brandHref?: string;
  scrollTopOnLogoClick?: boolean;
  hideOnScrollMode?: "default" | "terms";
};

export function LandingPageHeader({
  brandHref = "/",
  scrollTopOnLogoClick = false,
  hideOnScrollMode = "default",
}: LandingPageHeaderProps) {
  const { isSignedIn } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isSignedIn) {
      setIsAdmin(false);
      return;
    }

    const controller = new AbortController();

    async function loadRole() {
      try {
        const response = await fetch("/api/account/general", { signal: controller.signal });
        if (!response.ok) {
          setIsAdmin(false);
          sessionStorage.setItem("user-role", "");
          return;
        }
        const data = (await response.json()) as { role?: string };
        const role = data.role ?? "";
        sessionStorage.setItem("user-role", role);
        setIsAdmin(role === "admin");
      } catch {
        if (!controller.signal.aborted) {
          setIsAdmin(false);
        }
      }
    }

    void loadRole();
    return () => controller.abort();
  }, [isSignedIn]);

  const links = useMemo(() => [...BASE_LINKS], []);

  return (
    <SiteHeader
      fullWidth
      brandHref={brandHref}
      onBrandClick={scrollTopOnLogoClick ? () => window.scrollTo({ top: 0, behavior: "smooth" }) : undefined}
      menuHeader="Arao Project"
      leading={<LandingAuthControls />}
      mobileLeading={<LandingAuthControlsCompact />}
      mobileNotif={<HeaderProfileLink />}
      mobileProfile={<HeaderDrawerAvatar />}
      mobileLogout={<HeaderLogoutButton />}
      mobileFooterLogout={isSignedIn ? null : <HeaderLogoutButton />}
      isAdmin={isAdmin}
      isSignedIn={isSignedIn ?? false}
      version={4}
      links={links}
      hideOnScrollMode={hideOnScrollMode}
    />
  );
}
