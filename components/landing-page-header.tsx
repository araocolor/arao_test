import { LandingAuthControls, LandingAuthControlsCompact } from "@/components/landing-auth-controls";
import { HeaderProfileLink } from "@/components/header-profile-link";
import { HeaderLogoutButton } from "@/components/header-logout-button";
import { SiteHeader } from "@/components/site-header";

export function LandingPageHeader() {
  return (
    <SiteHeader
      fullWidth
      leading={<LandingAuthControls />}
      mobileLeading={<LandingAuthControlsCompact />}
      mobileProfile={<HeaderProfileLink />}
      mobileLogout={<HeaderLogoutButton />}
      links={[
        { href: "/arao", label: "ARAO 소개" },
        { href: "/gallery", label: "프로파일" },
        { href: "/pricing", label: "구매정책" },
        { href: "/manual", label: "설치방법" },
      ]}
    />
  );
}
