import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function UserColorPage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<{ category?: string; index?: string; likesSheet?: string; t?: string }>;
}) {
  const { profileId } = await params;
  const { category, index, likesSheet } = await searchParams;
  const supabase = createSupabaseAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, email, full_name, icon_image, created_at")
    .eq("id", profileId)
    .maybeSingle();

  const displayName = profile?.username || profile?.email || "알 수 없는 사용자";
  const joined = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("ko-KR")
    : "가입일 정보 없음";
  const backHref =
    category && index
      ? `/gallery?category=${encodeURIComponent(category)}&index=${encodeURIComponent(index)}&likesSheet=${likesSheet === "1" ? "1" : "1"}&t=${Date.now()}`
      : "/gallery";

  return (
    <main className="account-page" style={{ paddingTop: 30, paddingBottom: 40 }}>
      <div className="account-content" style={{ maxWidth: 760 }}>
        <section className="admin-panel-card stack account-section-card page-slide-down">
          <h2>{displayName}</h2>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {profile?.icon_image ? (
              <img
                src={profile.icon_image}
                alt=""
                style={{ width: 44, height: 44, borderRadius: 999, objectFit: "cover", flexShrink: 0 }}
              />
            ) : (
              <div style={{ width: 44, height: 44, borderRadius: 999, background: "#d1d5db", flexShrink: 0 }} />
            )}

            <div style={{ display: "grid", gap: 2 }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{displayName}</p>
              <p style={{ margin: 0, fontSize: 13, color: "#4b5563" }}>가입일 {joined}</p>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <Link href={backHref} prefetch={true}>
              <button type="button" className="gallery-sheet-submit" style={{ width: "auto", padding: "10px 14px" }}>
                {"< 돌아가기"}
              </button>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
