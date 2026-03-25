import { LandingPageFooter } from "@/components/landing-page-footer";
import { LandingPageHeader } from "@/components/landing-page-header";
import { GalleryHeroItem } from "@/components/gallery-hero-item";
import { getLandingContent } from "@/lib/landing-content";

export default async function GalleryPage() {
  const landingContent = await getLandingContent();

  const { beforeImageFull, afterImageFull } = landingContent.comparison;

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

        <section className="landing-stack-sm">
          <h2 className="gallery-section-title">인물</h2>
          <GalleryHeroItem beforeImage={beforeImageFull} afterImage={afterImageFull} label="인물" />
        </section>

        <section className="landing-stack-sm">
          <h2 className="gallery-section-title">환경야외</h2>
          <GalleryHeroItem beforeImage={beforeImageFull} afterImage={afterImageFull} label="환경야외" />
        </section>

        <section className="landing-stack-sm">
          <h2 className="gallery-section-title">실내카페</h2>
          <GalleryHeroItem beforeImage={beforeImageFull} afterImage={afterImageFull} label="실내카페" />
        </section>

        <LandingPageFooter content={landingContent.footer} />
      </div>
    </main>
  );
}
