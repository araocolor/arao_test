export const revalidate = 3600;

import Link from "next/link";
import { redirect } from "next/navigation";
import { LandingPageFooter } from "@/components/landing-page-footer";
import { LandingPageHeader } from "@/components/landing-page-header";
import { LandingVideoSection } from "@/components/landing-video-section";
import { getLandingContent } from "@/lib/landing-content";
import { AccountPrefetchWrapper } from "@/components/account-prefetch-wrapper";
import { HomeEntryLoader } from "@/components/home-entry-loader";

// A: arao.kr 방문 시 목업(public/arao)으로 임시 노출.
// 복귀하려면 이 함수를 지우고 아래 LegacyHomePage를 HomePage로 되돌리면 됨.
export default function HomePage() {
  redirect("/arao/index.html");
}

// B: 기존 홈 (보존)
async function LegacyHomePage() {
  const landingContent = await getLandingContent();

  return (
    <HomeEntryLoader>
      <AccountPrefetchWrapper>
        <main className="landing-page">
          <LandingPageHeader />

          <div className="landing-shell">
            <article
              className="landing-comparison-item before landing-comparison-mobile-only"
              style={{ ["--landing-image" as string]: `url("${landingContent.comparison.beforeImage}")` }}
            />

            <section className="landing-hero landing-stack-sm landing-hero-intro" id="intro">
              <img src="/apple-touch-icon.png" alt="ARAO" style={{ width: 40, height: 40, borderRadius: 10, display: "block", margin: "0 auto" }} />
              <span className="landing-section-label landing-hero-badge">{landingContent.hero.badge}</span>
              <h1 className="landing-hero-title">{landingContent.hero.title}</h1>
              <p className="landing-hero-body">{landingContent.hero.body}</p>
              <Link className="landing-button landing-button-primary" href={landingContent.hero.ctaHref}>
                <span className="landing-button-icon" />
                {landingContent.hero.ctaLabel}
              </Link>
            </section>

            <div className="landing-comparison">
              <article
                className="landing-comparison-item before"
                style={{ ["--landing-image" as string]: `url("${landingContent.comparison.beforeImage}")` }}
              />
              <article
                className="landing-comparison-item after"
                style={{ ["--landing-image" as string]: `url("${landingContent.comparison.afterImage}")` }}
              />
            </div>


            {/* <section className="landing-stack-sm" id="pricing">
              <Link href="/user_review" className="landing-review-section-link">
                <span className="landing-section-label">{landingContent.reviews.sectionTitle}</span>
              </Link>
              <div className="landing-reviews">
                {landingContent.reviews.items.map((item) => (
                  <Link
                    href="/user_review"
                    key={`${item.name}-${item.detail}`}
                    className="landing-review-card-link"
                  >
                    <article
                      className={
                        item.variant === "glass"
                          ? "landing-card landing-card-glass landing-stack-xs"
                          : "landing-card landing-card-review landing-stack-xs"
                      }
                    >
                      <p className="landing-review-quote">{item.quote}</p>
                      <div className="landing-review-rating">{item.rating}</div>
                      <div className="landing-stack-xs">
                        <p className="landing-review-name">{item.name}</p>
                        <p className="landing-review-detail">{item.detail}</p>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </section> */}

            <LandingVideoSection
              label={landingContent.video.sectionTitle}
              title={landingContent.video.title}
              body={landingContent.video.body}
              youtubeUrl={landingContent.video.youtubeUrl}
            />

            <LandingPageFooter content={landingContent.footer} />
          </div>
        </main>
      </AccountPrefetchWrapper>
    </HomeEntryLoader>
  );
}
