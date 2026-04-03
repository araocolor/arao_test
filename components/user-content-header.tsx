"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { BoardHeader } from "@/components/board-header";

type Props = {
  reviewId: string;
  isAuthor: boolean;
};

export function UserContentHeader({ reviewId, isAuthor }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromWrite = searchParams.get("from") === "write";

  function handleDelete() {
    if (!confirm("게시글을 삭제할까요?")) return;

    // 캐시 즉시 제거 + 리스트로 이동
    try {
      const listRaw = sessionStorage.getItem("user-review-list-cache");
      if (listRaw) {
        const parsed = JSON.parse(listRaw) as { data: { items: unknown[]; total: number }; ts: number };
        parsed.data.items = (parsed.data.items as Array<{ id: string }>).filter((item) => item.id !== reviewId);
        parsed.data.total = Math.max(parsed.data.total - 1, 0);
        sessionStorage.setItem("user-review-list-cache", JSON.stringify(parsed));
      }
      sessionStorage.removeItem(`user-review-content-${reviewId}`);
      sessionStorage.removeItem(`user-review-likes-${reviewId}`);
      sessionStorage.removeItem(`user-review-comments-${reviewId}`);
    } catch {}

    router.push("/user_review");

    // 백그라운드에서 실제 삭제
    fetch(`/api/main/user-review/${reviewId}`, { method: "DELETE" }).catch(() => {});
  }

  const menuItems = isAuthor
    ? [
        { label: "수정하기", onClick: () => router.push(`/write_review?id=${reviewId}`) },
        { label: "삭제하기", onClick: handleDelete },
      ]
    : [];

  return <BoardHeader menuItems={menuItems} onBack={fromWrite ? () => router.push("/user_review") : undefined} />;
}
