import { auth, currentUser } from "@clerk/nextjs/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncProfile } from "@/lib/profiles";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AccountUserPage({
  searchParams,
}: {
  searchParams: Promise<{ profileId?: string; username?: string }>;
}) {
  const { profileId } = await searchParams;
  const { userId } = await auth();

  if (!userId) {
    return (
      <div className="admin-panel-card stack account-section-card page-slide-down">
        <h2>사용자프로파일</h2>
        <p className="muted">로그인이 필요합니다.</p>
      </div>
    );
  }

  const me = await currentUser();
  const myEmail = me?.emailAddresses?.[0]?.emailAddress ?? me?.primaryEmailAddress?.emailAddress;
  const myFullName = me?.fullName || null;
  const myProfile = await syncProfile({ email: myEmail, fullName: myFullName });

  // userpage 접근 조건: 현재 로그인 사용자도 아이디(username)를 등록한 상태여야 함
  if (!myProfile?.username) {
    return (
      <div className="admin-panel-card stack account-section-card page-slide-down">
        <h2>사용자프로파일</h2>
        <p className="muted">아이디 등록 후 이용 가능합니다.</p>
        <div>
          <Link href="/account/general" prefetch={true}>
            <button type="button" className="gallery-sheet-submit" style={{ width: "auto", padding: "10px 14px" }}>
              아이디 등록하기
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (!profileId) {
    return (
      <div className="admin-panel-card stack account-section-card page-slide-down">
        <h2>사용자프로파일</h2>
        <p className="muted">사용자 아이디 정보가 없습니다.</p>
      </div>
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, email, full_name, icon_image, phone, role, created_at")
    .eq("id", profileId)
    .maybeSingle();

  if (!profile) {
    return (
      <div className="admin-panel-card stack account-section-card page-slide-down">
        <h2>사용자프로파일</h2>
        <p className="muted">해당 사용자를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const displayId = profile.username || profile.email || "사용자";
  const joined = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("ko-KR")
    : "가입일 정보 없음";

  return (
    <div className="admin-panel-card stack account-section-card page-slide-down">
      <h2>{displayId}의 사용자프로파일</h2>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {profile.icon_image ? (
          <img
            src={profile.icon_image}
            alt=""
            style={{ width: 44, height: 44, borderRadius: 999, objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <div style={{ width: 44, height: 44, borderRadius: 999, background: "#d1d5db", flexShrink: 0 }} />
        )}

        <div style={{ display: "grid", gap: 2 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>아이디: {displayId}</p>
          <p style={{ margin: 0, fontSize: 13, color: "#4b5563" }}>가입일 {joined}</p>
        </div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <p style={{ margin: 0 }}><strong>이메일:</strong> {profile.email}</p>
        <p style={{ margin: 0 }}><strong>이름:</strong> {profile.full_name ?? "없음"}</p>
        <p style={{ margin: 0 }}><strong>연락처:</strong> {profile.phone ?? "없음"}</p>
        <p style={{ margin: 0 }}><strong>권한:</strong> {profile.role}</p>
      </div>
    </div>
  );
}
