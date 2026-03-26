import { LandingPageFooter } from "@/components/landing-page-footer";
import { LandingPageHeader } from "@/components/landing-page-header";
import { GalleryHeroItem } from "@/components/gallery-hero-item";
import { getLandingContent } from "@/lib/landing-content";
import { GALLERY_CATEGORIES, GALLERY_CATEGORY_LABELS, GALLERY_CATEGORY_DEFAULTS } from "@/lib/gallery-categories";

export default async function GalleryPage() {
  const landingContent = await getLandingContent();

  return (
    <main className="landing-page">
      <LandingPageHeader />

      <div className="landing-shell">
        <section className="landing-hero landing-stack-sm">
          <span className="landing-section-label">Gallery</span>
          <h1 className="landing-hero-title">{landingContent.comparison.sectionTitle}</h1>
          <p className="landing-hero-body">
            버튼을 누르고 있는 동안 Before 사진을 확인할 수 있습니다.
          </p>
        </section>

        {GALLERY_CATEGORIES.map((category) => {
          const item = landingContent.gallery[category];
          if (!item) return null;
          const body = item.body || GALLERY_CATEGORY_DEFAULTS[category];
          return (
            <section key={category} className="landing-stack-sm">
              <h2 className="gallery-section-title">{GALLERY_CATEGORY_LABELS[category]}</h2>
              <p className="gallery-section-body">{body}</p>
              <GalleryHeroItem
                beforeImage={item.beforeImageFull}
                afterImage={item.afterImageFull}
                label={GALLERY_CATEGORY_LABELS[category]}
              />
            </section>
          );
        })}

        <LandingPageFooter content={landingContent.footer} />
      </div>
    </main>
  );
}
