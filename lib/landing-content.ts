import sharp from "sharp";
import { unstable_cache, revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export { GALLERY_CATEGORIES, type GalleryCategory } from "@/lib/gallery-categories";
import type { GalleryCategory } from "@/lib/gallery-categories";

export type GalleryExif = {
  camera?: string;
  lens?: string;
  iso?: string;
  aperture?: string;
  exposureMode?: string;
  whiteBalance?: string;
};

export type GalleryItem = {
  beforeImage: string;
  beforeImageFull: string;
  afterImage: string;
  afterImageFull: string;
  title?: string;
  body?: string;
  caption?: string;
  aspectRatio?: string;
  exif?: GalleryExif;
};

export type LandingReview = {
  quote: string;
  name: string;
  detail: string;
  rating: string;
  variant: "review" | "glass";
};

export type LandingPlan = {
  name: string;
  price: string;
  unit: string;
  description: string;
  features: string[];
  accent: "soft" | "strong";
};

export type LandingContent = {
  hero: {
    badge: string;
    title: string;
    body: string;
    ctaLabel: string;
    ctaHref: string;
  };
  comparison: {
    sectionTitle: string;
    beforeLabel: string;
    beforeText: string;
    beforeImage: string;
    beforeImageFull: string;
    afterLabel: string;
    afterText: string;
    afterImage: string;
    afterImageFull: string;
  };
  reviews: {
    sectionTitle: string;
    items: LandingReview[];
  };
  pricing: {
    sectionTitle: string;
    title: string;
    body: string;
    plans: LandingPlan[];
  };
  video: {
    sectionTitle: string;
    title: string;
    body: string;
    youtubeUrl: string;
  };
  footer: {
    company: string;
    address: string;
    links: Array<{ label: string; href: string }>;
  };
  gallery: Partial<Record<GalleryCategory, GalleryItem>>;
};

export const defaultLandingContent: LandingContent = {
  hero: {
    badge: "Apple-inspired mobile landing",
    title: "복잡한 전환 과정을 더 단순하고 아름답게.",
    body: "작은 화면에서도 여유 있게 읽히는 구조와 부드러운 카드 인터랙션으로 첫 인상을 정리했습니다.",
    ctaLabel: "지금 시작하기",
    ctaHref: "#gallery",
  },
  comparison: {
    sectionTitle: "Before / After",
    beforeLabel: "Before",
    beforeText: "정보가 분산되고 메시지가 흐려져 핵심이 바로 들어오지 않는 상태",
    beforeImage: "/images/before.jpg",
    beforeImageFull: "/images/before.jpg",
    afterLabel: "After",
    afterText: "여백, 시선 흐름, 명확한 CTA로 한 번에 이해되는 iOS 스타일 랜딩 구조",
    afterImage: "/images/after.jpg",
    afterImageFull: "/images/after.jpg",
  },
  reviews: {
    sectionTitle: "사용자 리뷰",
    items: [
      {
        quote: "한 번에 비교가 되니까 결정을 훨씬 빨리 내릴 수 있었어요.",
        name: "민지",
        detail: "프로덕트 디자이너",
        rating: "★★★★★",
        variant: "review",
      },
      {
        quote: "복잡한 설명 없이 화면만 봐도 변화가 명확하게 느껴졌습니다.",
        name: "도윤",
        detail: "마케팅 리드",
        rating: "★★★★★",
        variant: "glass",
      },
      {
        quote: "모바일에서 보는 순간 바로 신뢰감이 들 정도로 정돈된 인상이었어요.",
        name: "서연",
        detail: "브랜드 매니저",
        rating: "★★★★★",
        variant: "review",
      },
      {
        quote: "여백과 타이포가 깔끔해서 iPhone 앱 소개 페이지처럼 느껴졌어요.",
        name: "지훈",
        detail: "스타트업 운영",
        rating: "★★★★★",
        variant: "glass",
      },
    ],
  },
  pricing: {
    sectionTitle: "Pricing",
    title: "필요한 범위에 맞춰 가볍게 시작하세요.",
    body: "개인 작업부터 팀 운영까지, 지금 단계에 맞는 요금 구성을 선택할 수 있습니다.",
    plans: [
      {
        name: "Starter",
        price: "₩29,000",
        unit: "/월",
        description: "작은 브랜드나 1인 운영에 맞는 기본 구성",
        features: ["모바일 랜딩 1개", "기본 관리자 접근", "기본 리뷰/이미지 관리"],
        accent: "soft",
      },
      {
        name: "Growth",
        price: "₩79,000",
        unit: "/월",
        description: "주문과 운영 관리를 함께 확장하려는 팀용 구성",
        features: ["랜딩 + 관리자 운영", "주문/매출 구조 확장", "관리자 역할 관리"],
        accent: "strong",
      },
      {
        name: "Scale",
        price: "문의",
        unit: "",
        description: "커스텀 결제, 글로벌 운영, 데이터 구조 확장용 구성",
        features: ["Stripe/PortOne 확장", "권한 세분화", "운영 요구사항 맞춤 설계"],
        accent: "soft",
      },
    ],
  },
  video: {
    sectionTitle: "ARAO 유튜브 영상",
    title: "프로파일 적용하면 유튜브 컨텐츠도 빠르게 쉽게",
    body: "영상으로 기능 흐름과 실제 적용 결과를 빠르게 확인할 수 있습니다.",
    youtubeUrl: "https://www.youtube.com/watch?v=3GJbE7dMUpc",
  },
  footer: {
    company: "ABC Studio",
    address: "서울특별시 성동구 성수이로 00",
    links: [
      { label: "이용약관", href: "#" },
      { label: "개인정보처리방침", href: "#" },
      { label: "고객지원", href: "#" },
    ],
  },
  gallery: {},
};

type LandingContentRow = {
  id: string;
  content: LandingContent;
};

const LANDING_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "landing-assets";

function isDataUrl(value: string) {
  return value.startsWith("data:image/");
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    throw new Error("Invalid image data URL");
  }

  const [, contentType, base64] = match;
  const buffer = Buffer.from(base64, "base64");
  const extension = contentType.split("/")[1] || "jpg";

  return {
    contentType,
    extension: extension === "jpeg" ? "jpg" : extension,
    buffer,
  };
}

async function uploadLandingImage(pathPrefix: string, imageValue: string) {
  if (!isDataUrl(imageValue)) {
    return { thumb: imageValue, full: imageValue };
  }

  const supabase = createSupabaseAdminClient();
  const { buffer } = parseDataUrl(imageValue);
  const timestamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const [thumbBuffer, fullBuffer] = await Promise.all([
    sharp(buffer).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
    sharp(buffer).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 87 }).toBuffer(),
  ]);

  const thumbPath = `landing/${pathPrefix}-thumb-${timestamp}.webp`;
  const fullPath = `landing/${pathPrefix}-full-${timestamp}.webp`;

  const [thumbResult, fullResult] = await Promise.all([
    supabase.storage.from(LANDING_STORAGE_BUCKET).upload(thumbPath, thumbBuffer, { contentType: "image/webp", upsert: true }),
    supabase.storage.from(LANDING_STORAGE_BUCKET).upload(fullPath, fullBuffer, { contentType: "image/webp", upsert: true }),
  ]);

  if (thumbResult.error) throw thumbResult.error;
  if (fullResult.error) throw fullResult.error;

  const { data: thumbData } = supabase.storage.from(LANDING_STORAGE_BUCKET).getPublicUrl(thumbPath);
  const { data: fullData } = supabase.storage.from(LANDING_STORAGE_BUCKET).getPublicUrl(fullPath);

  return { thumb: thumbData.publicUrl, full: fullData.publicUrl };
}

function mergeLandingContent(input?: Partial<LandingContent> | null): LandingContent {
  return {
    hero: {
      ...defaultLandingContent.hero,
      ...(input?.hero ?? {}),
    },
    comparison: {
      ...defaultLandingContent.comparison,
      ...(input?.comparison ?? {}),
    },
    reviews: {
      ...defaultLandingContent.reviews,
      ...(input?.reviews ?? {}),
      items:
        input?.reviews?.items?.length
          ? input.reviews.items.map((item, index) => ({
              ...defaultLandingContent.reviews.items[index % defaultLandingContent.reviews.items.length],
              ...item,
            }))
          : defaultLandingContent.reviews.items,
    },
    pricing: {
      ...defaultLandingContent.pricing,
      ...(input?.pricing ?? {}),
      plans:
        input?.pricing?.plans?.length
          ? input.pricing.plans.map((plan, index) => ({
              ...defaultLandingContent.pricing.plans[index % defaultLandingContent.pricing.plans.length],
              ...plan,
            }))
          : defaultLandingContent.pricing.plans,
    },
    video: {
      ...defaultLandingContent.video,
      ...(input?.video ?? {}),
    },
    footer: {
      ...defaultLandingContent.footer,
      ...(input?.footer ?? {}),
      links:
        input?.footer?.links?.length
          ? input.footer.links.map((link, index) => ({
              ...defaultLandingContent.footer.links[index % defaultLandingContent.footer.links.length],
              ...link,
            }))
          : defaultLandingContent.footer.links,
    },
    gallery: {
      ...defaultLandingContent.gallery,
      ...(input?.gallery ?? {}),
    },
  };
}

const fetchLandingContent = unstable_cache(
  async () => {
    try {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("landing_contents")
        .select("id, content")
        .eq("id", "main")
        .maybeSingle<LandingContentRow>();

      if (error || !data) {
        return defaultLandingContent;
      }

      return mergeLandingContent(data.content);
    } catch {
      return defaultLandingContent;
    }
  },
  ["landing-content"],
  { revalidate: 30, tags: ["landing-content"] },
);

export async function getLandingContent() {
  return fetchLandingContent();
}

export async function saveLandingContent(content: LandingContent, options?: { skipGallery?: boolean }) {
  const supabase = createSupabaseAdminClient();
  const mergedContent = mergeLandingContent(content);
  const [beforeResult, afterResult] = await Promise.all([
    uploadLandingImage("before", mergedContent.comparison.beforeImage),
    uploadLandingImage("after", mergedContent.comparison.afterImage),
  ]);

  let processedGallery = mergedContent.gallery;

  if (!options?.skipGallery) {
    const galleryCategories = (Object.keys(mergedContent.gallery) as GalleryCategory[]).filter(
      (cat) => mergedContent.gallery[cat] !== undefined,
    );
    const galleryEntries = await Promise.all(
      galleryCategories.map(async (category) => {
        const item = mergedContent.gallery[category]!;
        const [beforeRes, afterRes] = await Promise.all([
          uploadLandingImage(`gallery-${category}-before`, item.beforeImage),
          uploadLandingImage(`gallery-${category}-after`, item.afterImage),
        ]);
        return [category, {
          beforeImage: beforeRes.thumb,
          beforeImageFull: beforeRes.full,
          afterImage: afterRes.thumb,
          afterImageFull: afterRes.full,
          title: item.title,
          body: item.body,
          caption: item.caption,
          aspectRatio: item.aspectRatio,
          exif: item.exif,
        }] as [GalleryCategory, GalleryItem];
      }),
    );
    processedGallery = Object.fromEntries(galleryEntries) as Partial<Record<GalleryCategory, GalleryItem>>;
  }

  const nextContent: LandingContent = {
    ...mergedContent,
    comparison: {
      ...mergedContent.comparison,
      beforeImage: beforeResult.thumb,
      beforeImageFull: beforeResult.full,
      afterImage: afterResult.thumb,
      afterImageFull: afterResult.full,
    },
    gallery: processedGallery,
  };

  const { data, error } = await supabase
    .from("landing_contents")
    .upsert(
      {
        id: "main",
        content: nextContent,
      },
      { onConflict: "id" },
    )
    .select("id, content")
    .single<LandingContentRow>();

  if (error) {
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/gallery");

  return data.content;
}
