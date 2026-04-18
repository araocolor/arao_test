import { SignUp } from "@clerk/nextjs";
import { LandingPageHeader } from "@/components/landing-page-header";
import { normalizeRedirectPath } from "@/lib/auth-redirect";

type SignUpPageProps = {
  searchParams?: Promise<{ redirect_url?: string | string[] }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const redirectPath = normalizeRedirectPath(resolvedSearchParams.redirect_url);
  const signUpProps = redirectPath
    ? {
        forceRedirectUrl: redirectPath,
        fallbackRedirectUrl: redirectPath,
        signInUrl: `/sign-in?redirect_url=${encodeURIComponent(redirectPath)}`,
      }
    : {
        signInUrl: "/sign-in",
      };

  return (
    <main className="landing-page">
      <LandingPageHeader />

      <div className="landing-shell">
        <section className="auth-shell auth-shell-plain">
          <SignUp {...signUpProps} />
        </section>
      </div>
    </main>
  );
}
