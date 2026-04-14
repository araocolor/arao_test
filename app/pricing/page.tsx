import Link from "next/link";
import { LandingPageFooter } from "@/components/landing-page-footer";
import { LandingPageHeader } from "@/components/landing-page-header";
import { getLandingContent } from "@/lib/landing-content";

export default async function PricingPage() {
  const landingContent = await getLandingContent();

  return (
    <main className="landing-page">
      <LandingPageHeader />

      <div className="landing-shell">
        <section className="landing-hero landing-stack-sm">
          <span className="landing-section-label">{landingContent.pricing.sectionTitle}</span>
          <h1 className="landing-hero-title">{landingContent.pricing.title}</h1>
          <p className="landing-hero-body">{landingContent.pricing.body}</p>
        </section>

        <section className="pricing-grid">
          {landingContent.pricing.plans.map((plan) => (
            <article
              key={plan.name}
              className={
                plan.accent === "strong"
                  ? "pricing-card pricing-card-featured landing-stack-sm"
                  : "pricing-card landing-stack-sm"
              }
            >
              <div className="landing-stack-xs">
                <div className="pricing-price-row">
                  <strong className="pricing-price">{plan.price}</strong>
                </div>
                <p className="pricing-copy">{plan.description}</p>
              </div>

              <Link className="landing-button landing-button-primary" href="/admin">
                구매하기
              </Link>
            </article>
          ))}
        </section>

        <LandingPageFooter content={landingContent.footer} />
      </div>
    </main>
  );
}
