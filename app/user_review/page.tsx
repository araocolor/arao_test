import { LandingPageHeader } from "@/components/landing-page-header";
import { MainUserReviewPage } from "@/components/main-user-review-page";
import { Suspense } from "react";

export default async function MainUserReviewListPage() {
  return (
    <main className="landing-page">
      <LandingPageHeader />

      <div className="landing-shell">
        <section className="landing-stack-sm">
          <span className="landing-section-label">사용자 후기</span>
          <Suspense fallback={<div className="user-review-page" />}>
            <MainUserReviewPage />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
