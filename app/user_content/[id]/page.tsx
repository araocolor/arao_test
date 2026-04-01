import { auth } from "@clerk/nextjs/server";
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
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const item = await getUserReviewById(id);
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

  await incrementUserReviewViewCount(id);
  const isAuthor = userId === item.profileId;

  return (
    <main className="landing-page">
      <UserContentHeader reviewId={id} isAuthor={isAuthor} />
      <div className="landing-shell">
        <article className="user-content-article">
          <h1 className="user-content-title">{item.title}</h1>
          <p className="user-content-meta muted">
            {item.authorId} · {formatDate(item.createdAt)} · 조회 {item.viewCount + 1}
          </p>
          {item.thumbnailImage && (
            <img
              src={item.thumbnailImage}
              alt=""
              className="user-content-thumb"
            />
          )}
          <p className="user-content-body">{item.content}</p>
        </article>

        <UserContentInteractions reviewId={id} />
      </div>
    </main>
  );
}
