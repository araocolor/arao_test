import { LandingPageHeader } from "@/components/landing-page-header";
import { ColorGrid } from "@/components/color-grid";
import { getColorList } from "@/lib/colors";

export const revalidate = 60;

export default async function ColorPage() {
  const items = await getColorList(30);

  return (
    <main className="color-page-shell">
      <LandingPageHeader />
      <div className="color-feed-wrap">
        {items.length === 0 ? (
          <div className="color-empty">등록된 컬러가 없습니다.</div>
        ) : (
          <ColorGrid items={items} />
        )}
      </div>
    </main>
  );
}
