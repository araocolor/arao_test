import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { LandingPageHeader } from "@/components/landing-page-header";
import { UserDashboard } from "@/components/user-dashboard";
import { syncProfile } from "@/lib/profiles";
import { getInquiriesByProfile, type Inquiry } from "@/lib/consulting";
import type { Profile } from "@/lib/profiles";

async function UserDashboardWrapper({ profile }: { profile: Profile }) {
  let initialInquiries: Inquiry[] = [];
  try {
    const result = await getInquiriesByProfile(profile.id, undefined, 1, 20);
    initialInquiries = result.inquiries;
  } catch (error) {
    console.error("Failed to fetch inquiries:", error);
  }

  return (
    <UserDashboard
      email={profile.email}
      fullName={profile.full_name}
      username={profile.username}
      hasPassword={Boolean(profile.password_hash)}
      phone={profile.phone}
      initialInquiries={initialInquiries}
    />
  );
}

export default async function AccountPage() {
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
      <LandingPageHeader />
      <main className="admin-page">
        {profileError ? (
          <section className="section stack">
            <h1>프로필 연결 오류</h1>
            <p className="muted">이 계정의 profile을 읽는 중 문제가 발생했습니다.</p>
            <p className="muted">message: {profileError.message ?? "없음"}</p>
            <p className="muted">hint: {profileError.hint ?? "없음"}</p>
            <p className="muted">로그인 이메일: {email ?? "없음"}</p>
          </section>
        ) : profile ? (
          <UserDashboardWrapper profile={profile} />
        ) : (
          <section className="section stack">
            <h1>회원 정보를 불러오지 못했습니다</h1>
            <p className="muted">다시 로그인한 뒤 시도해주세요.</p>
          </section>
        )}
      </main>
    </>
  );
}
