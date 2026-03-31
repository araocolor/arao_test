import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { syncProfile } from "@/lib/profiles";

export const dynamic = "force-dynamic";

export default async function AccountTestPage() {
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
    <div className="admin-panel-card stack account-section-card page-slide-down">
      <h2>account/test</h2>
      <p className="muted">불러온 아이디(또는 이메일):</p>
      <p style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>{displayId}</p>
    </div>
  );
}
