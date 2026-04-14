import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { syncProfile } from "@/lib/profiles";

export const dynamic = "force-dynamic";

export default async function MyColorPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? user?.primaryEmailAddress?.emailAddress;
  const fullName = user?.fullName || null;
  const profile = await syncProfile({ email, fullName });
  const displayId = user?.username || profile?.username || profile?.email || email || "회원";

  return (
    <div className="account-panel-card stack account-section-card page-slide-down">
      <h2>{displayId}의 프로파일 입니다.</h2>
      <p className="muted">나의 컬러 프로파일 페이지입니다.</p>
      <p style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>{displayId}</p>
      <div style={{ marginTop: 8 }}>
        <Link href="/color/write" prefetch={true}>
          <button type="button" className="account-btn">
            레시피 등록
          </button>
        </Link>
      </div>
    </div>
  );
}
