export const revalidate = 0;

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
          const beforeSrc = item.beforeImageFull || item.beforeImage || "";
          const afterSrc = item.afterImageFull || item.afterImage || "";
          if (!beforeSrc || !afterSrc) return null;
          const title = item.title || GALLERY_CATEGORY_LABELS[category];
          const body = item.body || GALLERY_CATEGORY_DEFAULTS[category];
          const bodyLines = body.split("\n");
          return (
            <section key={category} className="gallery-section">
              <h2 className="gallery-section-title">{title}</h2>
              <p className="gallery-section-body">
                {bodyLines.map((line, i) => (
                  <span key={i}>{line}{i < bodyLines.length - 1 ? <br /> : null}</span>
                ))}
              </p>
              <GalleryHeroItem
                beforeImage={beforeSrc}
                afterImage={afterSrc}
                label={GALLERY_CATEGORY_LABELS[category]}
              />
              {item.caption ? <p className="gallery-caption">{item.caption}</p> : null}
            </section>
          );
        })}

        <LandingPageFooter content={landingContent.footer} />
      </div>
    </main>
  );
}
