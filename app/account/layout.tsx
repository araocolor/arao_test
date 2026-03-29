import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SimpleHeader } from "@/components/simple-header";
import { AccountNavLinks } from "@/components/account-nav-links";
import { AdminSignOut } from "@/components/admin-sign-out";
import { syncProfile } from "@/lib/profiles";
import { AccountPrefetchWrapper } from "@/components/account-prefetch-wrapper";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;
  let profile = null;
  let profileError: { message?: string; hint?: string } | null = null;

  try {
    profile = await syncProfile({ email, fullName });
  } catch (error) {
    if (error instanceof Error) {
      profileError = { message: error.message };
    } else if (typeof error === "object" && error !== null) {
      profileError = error as { message?: string; hint?: string };
    } else {
      profileError = { message: "Unknown profile sync error" };
    }
  }

  return (
    <>
      <SimpleHeader />
      <AccountPrefetchWrapper>
        <main className="account-page">
          {profileError ? (
            <div className="account-content">
              <section className="section stack">
                <h1>프로필 연결 오류</h1>
                <p className="muted">이 계정의 profile을 읽는 중 문제가 발생했습니다.</p>
                <p className="muted">message: {profileError.message ?? "없음"}</p>
                <p className="muted">hint: {profileError.hint ?? "없음"}</p>
                <p className="muted">로그인 이메일: {email ?? "없음"}</p>
              </section>
            </div>
          ) : profile ? (
            <div className="account-content">
              {children}
            </div>
          ) : (
            <div className="account-content">
              <section className="section stack">
                <h1>회원 정보를 불러오지 못했습니다</h1>
                <p className="muted">다시 로그인한 뒤 시도해주세요.</p>
              </section>
            </div>
          )}
        </main>
      </AccountPrefetchWrapper>
      <AccountNavLinks footer />
    </>
  );
}
