"use client";

import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

type AccountDeletedViewProps = {
  deletedAt: string | null;
  deleteScheduledAt: string | null;
  email: string;
};

function formatDays(scheduled: string | null): number {
  if (!scheduled) return 0;
  const remainMs = new Date(scheduled).getTime() - Date.now();
  return Math.max(0, Math.ceil(remainMs / (24 * 60 * 60 * 1000)));
}

export function AccountDeletedView({ deleteScheduledAt, email }: AccountDeletedViewProps) {
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { signOut } = useClerk();
  const router = useRouter();

  const daysLeft = formatDays(deleteScheduledAt);

  async function restore() {
    setRestoring(true);
    setMessage(null);
    const res = await fetch("/api/account/delete/restore", { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    setRestoring(false);
    if (!res.ok) {
      setMessage(data.message ?? "복구 실패");
      return;
    }
    router.push("/account/general");
    router.refresh();
  }

  async function leave() {
    await signOut();
    router.push("/");
  }

  return (
    <section className="account-deleted-view">
      <h1>회원탈퇴 진행 중</h1>
      <p className="account-deleted-email">{email}</p>
      <p className="account-deleted-desc">
        이 계정은 회원탈퇴가 신청된 상태입니다.<br />
        영구 삭제까지 <strong>{daysLeft}일</strong> 남았습니다.
      </p>
      <p className="account-deleted-info">
        지금 복구하시면 다시 모든 기능을 사용할 수 있습니다.<br />
        삭제된 게시글은 복구되지 않습니다.
      </p>
      {message && <div className="account-deleted-msg">{message}</div>}
      <div className="account-deleted-actions">
        <button type="button" className="account-deleted-leave" onClick={leave}>
          그대로 두기
        </button>
        <button type="button" className="account-deleted-restore" onClick={restore} disabled={restoring}>
          {restoring ? "복구 중..." : "계정 복구하기"}
        </button>
      </div>
    </section>
  );
}
