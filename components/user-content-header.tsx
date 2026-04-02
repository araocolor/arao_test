"use client";

import { useRouter } from "next/navigation";
import { BoardHeader } from "@/components/board-header";

type Props = {
  reviewId: string;
  isAuthor: boolean;
};

export function UserContentHeader({ reviewId, isAuthor }: Props) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("게시글을 삭제할까요?")) return;
    const res = await fetch(`/api/main/user-review/${reviewId}`, { method: "DELETE" });
    if (res.ok) {
      // 캐시에서 삭제된 글 제거
      try {
        // 리스트 캐시
        const listRaw = sessionStorage.getItem("user-review-list-cache");
        if (listRaw) {
          const parsed = JSON.parse(listRaw) as { data: { items: unknown[]; total: number }; ts: number };
          parsed.data.items = (parsed.data.items as Array<{ id: string }>).filter((item) => item.id !== reviewId);
          parsed.data.total = Math.max(parsed.data.total - 1, 0);
          sessionStorage.setItem("user-review-list-cache", JSON.stringify(parsed));
        }
        // 본문/좋아요/댓글 캐시
        sessionStorage.removeItem(`user-review-content-${reviewId}`);
        sessionStorage.removeItem(`user-review-likes-${reviewId}`);
        sessionStorage.removeItem(`user-review-comments-${reviewId}`);
      } catch {}
      router.push("/user_review");
    }
  }

  const menuItems = isAuthor
    ? [
        { label: "수정하기", onClick: () => router.push(`/write_review?id=${reviewId}`) },
        { label: "삭제하기", onClick: handleDelete },
      ]
    : [];

  return <BoardHeader menuItems={menuItems} />;
}
