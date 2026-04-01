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
