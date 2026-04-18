import { SignIn } from "@clerk/nextjs";
import { LandingPageHeader } from "@/components/landing-page-header";
import { normalizeRedirectPath } from "@/lib/auth-redirect";

type SignInPageProps = {
  searchParams?: Promise<{ redirect_url?: string | string[] }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const redirectPath = normalizeRedirectPath(resolvedSearchParams.redirect_url);
  const signInProps = redirectPath
    ? {
        forceRedirectUrl: redirectPath,
        fallbackRedirectUrl: redirectPath,
        signUpUrl: `/sign-up?redirect_url=${encodeURIComponent(redirectPath)}`,
      }
    : {
        signUpUrl: "/sign-up",
      };

  return (
    <main className="landing-page">
      <LandingPageHeader />

      <div className="landing-shell">
        <section className="auth-shell auth-shell-plain">
          <SignIn {...signInProps} />
        </section>
      </div>
    </main>
  );
}
