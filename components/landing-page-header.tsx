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
        { href: "/arao", label: "Arao" },
        { href: "/gallery", label: "Gallery" },
        { href: "/pricing", label: "Buy" },
        { href: "/manual", label: "Manual" },
      ]}
    />
  );
}
