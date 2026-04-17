import { Suspense } from "react";
import { LandingPageFooter } from "@/components/landing-page-footer";
import { LandingPageHeader } from "@/components/landing-page-header";
import { GalleryCardsClient } from "@/components/gallery-cards-client";
import { getLandingContent } from "@/lib/landing-content";
import { GALLERY_CATEGORIES } from "@/lib/gallery-categories";

export default async function GalleryPage() {
  const landingContent = await getLandingContent();

  const items = GALLERY_CATEGORIES.flatMap((category, categoryIdx) => {
    const item = landingContent.gallery[category];
    if (!item) return [];
    return [{ category, categoryIdx, item }];
  });

  return (
    <main
      className="landing-page gallery-page"
      style={{ WebkitTextSizeAdjust: "100%", textSizeAdjust: "100%" }}
    >
      <LandingPageHeader hideOnScrollMode="terms" />

      <div className="landing-shell">
        <Suspense>
          <GalleryCardsClient items={items} />
        </Suspense>

        <LandingPageFooter content={landingContent.footer} />
      </div>
    </main>
  );
}
