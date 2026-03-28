"use client";

import { useUser } from "@clerk/nextjs";
import { LandingAuthControls, LandingAuthControlsCompact } from "@/components/landing-auth-controls";
import { HeaderProfileLink } from "@/components/header-profile-link";
import { HeaderLogoutButton } from "@/components/header-logout-button";
import { SiteHeader } from "@/components/site-header";

export function LandingPageHeader() {
  const { isSignedIn } = useUser();

  const links = [
    { href: "/arao", label: "ARAO 소개" },
    { href: "/gallery", label: "프로파일" },
    { href: "/pricing", label: "구매정책" },
    { href: "/manual", label: "설치방법" },
    ...(isSignedIn ? [{ href: "/account/general", label: "마이페이지" }] : []),
  ];

  return (
    <SiteHeader
      fullWidth
      menuHeader="Arao Project"
      leading={<LandingAuthControls />}
      mobileLeading={<LandingAuthControlsCompact />}
      mobileProfile={<HeaderProfileLink />}
      mobileLogout={<HeaderLogoutButton />}
      links={links}
    />
  );
}
