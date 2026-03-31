export const revalidate = 0;

import { LandingPageFooter } from "@/components/landing-page-footer";
import { LandingPageHeader } from "@/components/landing-page-header";
import { GalleryCard } from "@/components/gallery-card";
import { getLandingContent } from "@/lib/landing-content";
import { GALLERY_CATEGORIES, GALLERY_CATEGORY_LABELS, GALLERY_CATEGORY_DEFAULTS } from "@/lib/gallery-categories";

function formatGalleryExifCaption(item: { caption?: string; exif?: { camera?: string; lens?: string; iso?: string; aperture?: string; exposureMode?: string } }) {
  if (item.caption) {
    return item.caption;
  }

  const parts = [
    item.exif?.camera,
    item.exif?.lens,
    item.exif?.iso ? `ISO ${item.exif.iso}` : "",
    item.exif?.aperture,
    item.exif?.exposureMode,
  ].filter(Boolean);

  return parts.join(" / ");
}

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; index?: string; commentId?: string; likesSheet?: string; t?: string }>;
}) {
  const { category: openCategory, index: openIndex, commentId: openCommentId, likesSheet, t: openTimestamp } = await searchParams;
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

        {GALLERY_CATEGORIES.map((category, categoryIdx) => {
          const item = landingContent.gallery[category];
          if (!item) return null;
          const beforeSrc = item.beforeImageFull || item.beforeImage || "";
          const afterSrc = item.afterImageFull || item.afterImage || "";
          if (!beforeSrc || !afterSrc) return null;
          const title = item.title || GALLERY_CATEGORY_LABELS[category];
          const body = item.body || GALLERY_CATEGORY_DEFAULTS[category];
          const caption = formatGalleryExifCaption(item);
          return (
            <GalleryCard
              key={category}
              category={category}
              index={categoryIdx}
              title={title}
              body={body}
              beforeImage={beforeSrc}
              afterImage={afterSrc}
              caption={caption || undefined}
              aspectRatio={item.aspectRatio}
              autoOpenComments={category === openCategory && String(categoryIdx) === openIndex}
              autoOpenLikes={likesSheet === "1" && category === openCategory && String(categoryIdx) === openIndex}
              highlightCommentId={category === openCategory && String(categoryIdx) === openIndex ? openCommentId : undefined}
              openTimestamp={category === openCategory && String(categoryIdx) === openIndex ? openTimestamp : undefined}
            />
          );
        })}

        <LandingPageFooter content={landingContent.footer} />
      </div>
    </main>
  );
}
