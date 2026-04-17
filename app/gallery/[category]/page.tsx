import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { LandingPageFooter } from "@/components/landing-page-footer";
import { LandingPageHeader } from "@/components/landing-page-header";
import { getLandingContent } from "@/lib/landing-content";
import { GALLERY_CATEGORIES, GALLERY_CATEGORY_LABELS, type GalleryCategory } from "@/lib/gallery-categories";

function isGalleryCategory(value: string): value is GalleryCategory {
  return (GALLERY_CATEGORIES as readonly string[]).includes(value);
}

export default async function GalleryDetailPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isGalleryCategory(category)) notFound();

  const landingContent = await getLandingContent();
  const item = landingContent.gallery[category];
  if (!item) notFound();

  const imageSrc = item.afterImage || item.afterImageFull || "";
  if (!imageSrc) notFound();

  const label = GALLERY_CATEGORY_LABELS[category];
  const title = item.title || label;

  return (
    <main
      className="landing-page gallery-page"
      style={{ WebkitTextSizeAdjust: "100%", textSizeAdjust: "100%" }}
    >
      <LandingPageHeader />

      <div className="gallery-detail-shell">
        <div className="gallery-detail-image-wrap">
          <Image
            src={imageSrc}
            alt={title}
            fill
            sizes="100vw"
            className="gallery-detail-image"
            priority
          />
        </div>

        <div className="gallery-detail-body">
          <h1 className="gallery-detail-title">{title}</h1>

          <div className="gallery-detail-meta">
            <span>프로파일 : ARAO</span>
            <span className="gallery-detail-meta-sep">/</span>
            <span>카테고리 : {label}</span>
          </div>

          <Link href="/color" className="gallery-detail-buy-button">
            구매하기
          </Link>
        </div>

        <LandingPageFooter content={landingContent.footer} />
      </div>
    </main>
  );
}
