export const revalidate = 3600;

import Link from "next/link";
import { LandingPageFooter } from "@/components/landing-page-footer";
import { LandingPageHeader } from "@/components/landing-page-header";
import { LandingVideoSection } from "@/components/landing-video-section";
import { getLandingContent } from "@/lib/landing-content";
import { AccountPrefetchWrapper } from "@/components/account-prefetch-wrapper";

export default async function HomePage() {
  const landingContent = await getLandingContent();

  return (
    <AccountPrefetchWrapper>
      <main className="landing-page">
      <LandingPageHeader />

      <div className="landing-shell">
        <article
          className="landing-comparison-item before"
          style={{ ["--landing-image" as string]: `url("${landingContent.comparison.beforeImage}")` }}
        />

        <section className="landing-hero landing-stack-sm" id="intro">
          <img src="/apple-touch-icon.png" alt="ARAO" style={{ width: 40, height: 40, borderRadius: 10, display: "block", margin: "0 auto" }} />
          <span className="landing-section-label">{landingContent.hero.badge}</span>
          <h1 className="landing-hero-title">{landingContent.hero.title}</h1>
          <p className="landing-hero-body">{landingContent.hero.body}</p>
          <Link className="landing-button landing-button-primary" href={landingContent.hero.ctaHref}>
            <span className="landing-button-icon" />
            {landingContent.hero.ctaLabel}
          </Link>
        </section>

        <article
          className="landing-comparison-item after"
          style={{ ["--landing-image" as string]: `url("${landingContent.comparison.afterImage}")` }}
        />


        <section className="landing-stack-sm" id="pricing">
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
        </section>

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
  );
}
