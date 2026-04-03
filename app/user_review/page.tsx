import { LandingPageHeader } from "@/components/landing-page-header";
import { LandingPageFooter } from "@/components/landing-page-footer";
import { MainUserReviewPage } from "@/components/main-user-review-page";
import { getLandingContent } from "@/lib/landing-content";

export default async function MainUserReviewListPage() {
  const landingContent = await getLandingContent();

  return (
    <main className="landing-page">
      <LandingPageHeader />

      <div className="landing-shell">
        <section className="landing-stack-sm">
          <span className="landing-section-label">사용자 후기</span>
          <MainUserReviewPage />
        </section>
        <LandingPageFooter content={landingContent.footer} />
      </div>
    </main>
  );
}

