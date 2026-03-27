import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { syncProfile } from "@/lib/profiles";
import { getInquiriesByProfile } from "@/lib/consulting";
import { isDesignMode, mockInquiries } from "@/lib/design-mock";
import type { Inquiry } from "@/lib/consulting";
import { ConsultingSection } from "@/components/consulting-section";

export default async function AccountConsultingPage() {
  // 디자인 모드: Clerk 로그인 없이 더미 데이터 표시
  if (isDesignMode) {
    return (
      <div className="admin-panel-card stack account-section-card account-section-card-consulting">
        <div className="account-section-head">
          <h2>상담내역</h2>
          <p className="muted">상담 요청과 답변 이력을 관리하는 자리입니다. 추후 문의 등록과 상태 변경 기능을 연결할 수 있습니다.</p>
        </div>
        <ConsultingSection initialInquiries={mockInquiries} />
      </div>
    );
  }

  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;

  let profile = null;
  let initialInquiries: Inquiry[] = [];

  try {
    profile = await syncProfile({ email, fullName });
    if (profile) {
      const result = await getInquiriesByProfile(profile.id, undefined, 1, 100);
      initialInquiries = result.inquiries;
    }
  } catch (error) {
    console.error("Failed to fetch consulting data:", error);
  }

  if (!profile) {
    return (
      <div className="admin-panel-card stack">
        <h1>오류</h1>
        <p className="muted">프로필 정보를 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="admin-panel-card stack account-section-card account-section-card-consulting">
      <div className="account-section-head">
        <h2>상담내역</h2>
        <p className="muted">상담 요청과 답변 이력을 관리하는 자리입니다. 추후 문의 등록과 상태 변경 기능을 연결할 수 있습니다.</p>
      </div>
      <ConsultingSection initialInquiries={initialInquiries} />
    </div>
  );
}
