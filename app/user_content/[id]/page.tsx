import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { getUserReviewById, incrementUserReviewViewCount } from "@/lib/user-reviews";
import { UserContentHeader } from "@/components/user-content-header";
import { UserContentInteractions } from "@/components/user-content-interactions";

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "0000.00.00";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export default async function MainUserContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ userId }, { id }] = await Promise.all([
    auth(),
    params,
  ]);
  if (!userId) {
    redirect("/sign-in");
  }

  const item = await getUserReviewById(id);
  // 응답 전송 후 조회수 증가 (렌더링 블로킹 없음)
  after(() => { void incrementUserReviewViewCount(id); });

  if (!item) {
    return (
      <main className="landing-page">
        <UserContentHeader reviewId={id} isAuthor={false} />
        <div className="landing-shell">
          <section className="section stack">
            <h2>게시글을 찾을 수 없습니다</h2>
          </section>
        </div>
      </main>
    );
  }

  // profiles.id = Clerk userId — currentUser() 불필요
  const isAuthor = !!userId && userId === item.profileId;

  // 단일 이미지 또는 JSON 배열 파싱
  let contentImages: string[] = [];
  if (item.thumbnailImage) {
    try {
      const parsed = JSON.parse(item.thumbnailImage);
      contentImages = Array.isArray(parsed) ? parsed : [item.thumbnailImage];
    } catch {
      contentImages = [item.thumbnailImage];
    }
  }

  // 첨부 파일 파싱
  let attachedFile: { name: string; type: string; data: string } | null = null;
  if (item.attachedFile) {
    try {
      const parsed = JSON.parse(item.attachedFile);
      if (parsed && typeof parsed.name === "string" && typeof parsed.data === "string") {
        attachedFile = parsed;
      }
    } catch {}
  }

  return (
    <main className="landing-page">
      <UserContentHeader reviewId={id} isAuthor={isAuthor} />
      <div className="landing-shell">
        <article className="user-content-article">
          <h1 className="user-content-title">{item.title}</h1>
          <p className="user-content-meta muted">
            {item.authorId} · {formatDate(item.createdAt)} · 조회 {item.viewCount + 1}
          </p>
          {contentImages.map((src, i) => (
            <img key={i} src={src} alt="" className="user-content-thumb" />
          ))}
          {attachedFile && (
            <a
              href={attachedFile.data}
              download={attachedFile.name}
              className="user-content-file-download"
            >
              <span className="user-content-file-zip-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </span>
              <span className="user-content-file-name">{attachedFile.name}</span>
              <span className="user-content-file-dl-label">다운로드</span>
            </a>
          )}
          <p className="user-content-body">{item.content}</p>
        </article>

        <UserContentInteractions reviewId={id} />
      </div>
    </main>
  );
}
