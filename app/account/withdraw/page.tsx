import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LandingPageHeader } from "@/components/landing-page-header";

export default async function AccountWithdrawPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <>
      <LandingPageHeader />
      <main className="admin-page">
        <section className="section stack">
          <h1>회원탈퇴</h1>
          <div className="muted">탈퇴 기능은 아직 최종 연결 전입니다. 진행 전에 주문, 상담, 후기 데이터 보존 정책을 먼저 정리하는 것이 안전합니다.</div>
          <Link className="account-delete-inline" href="/account">
            계정 페이지로 돌아가기
          </Link>
        </section>
      </main>
    </>
  );
}
