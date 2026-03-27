import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { LandingPageHeader } from "@/components/landing-page-header";
import { syncProfile } from "@/lib/profiles";
import { getAllInquiries, type InquiryWithProfile } from "@/lib/consulting";

export default async function ArticlePage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();
  if (!user?.emailAddresses?.[0]?.emailAddress) {
    return (
      <>
        <LandingPageHeader />
        <main className="admin-page">
          <section className="section stack">
            <h1>오류</h1>
            <p className="muted">사용자 정보를 불러올 수 없습니다.</p>
          </section>
        </main>
      </>
    );
  }

  const profile = await syncProfile({
    email: user.emailAddresses[0].emailAddress,
    fullName: user.fullName,
  });

  // 관리자만 접근 가능
  if (!profile || profile.role !== "admin") {
    return (
      <>
        <LandingPageHeader />
        <main className="admin-page">
          <section className="section stack">
            <h1>접근 권한 없음</h1>
            <p className="muted">관리자만 이 페이지에 접근할 수 있습니다.</p>
          </section>
        </main>
      </>
    );
  }

  // 1:1 상담 글 목록 조회
  const result = await getAllInquiries("consulting", undefined, 1, 50);
  const inquiries = result.inquiries;

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "답변대기중";
      case "in_progress":
        return "답변중";
      case "resolved":
        return "답변완료";
      case "closed":
        return "종료";
      default:
        return status;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "pending":
        return "consulting-status-pending";
      case "in_progress":
        return "consulting-status-progress";
      case "resolved":
        return "consulting-status-resolved";
      case "closed":
        return "consulting-status-closed";
      default:
        return "";
    }
  };

  return (
    <>
      <LandingPageHeader />
      <main className="admin-page">
        <div className="admin-panel stack">
          <p className="muted">1:1 상담</p>
          <div className="admin-panel-card stack">
            <p className="muted">Article</p>
            <h2>1:1 상담 글 목록</h2>
            <p className="muted">회원들이 작성한 1:1 상담 글들</p>

            {inquiries.length === 0 ? (
              <div className="consulting-empty" style={{ marginTop: "20px" }}>
                등록된 1:1 상담이 없습니다.
              </div>
            ) : (
              <div
                className="consulting-items article-list"
                style={{ marginTop: "20px" }}
              >
                <div className="admin-consulting-header-row">
                  <div className="col-email">이메일</div>
                  <div className="col-title">제목</div>
                  <div className="col-status">상태</div>
                  <div className="col-date">날짜</div>
                </div>

                {inquiries.map((inquiry: InquiryWithProfile) => (
                  <div
                    key={inquiry.id}
                    className="admin-consulting-item article-item"
                  >
                    <div className="col-email">
                      {inquiry.profile.email}
                    </div>
                    <div className="col-title">
                      {inquiry.title}
                    </div>
                    <div className="col-status">
                      <span
                        className={`consulting-status ${getStatusClass(
                          inquiry.status
                        )}`}
                      >
                        {getStatusLabel(inquiry.status)}
                      </span>
                    </div>
                    <div className="col-date">
                      {new Date(inquiry.created_at).toLocaleDateString(
                        "ko-KR"
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
