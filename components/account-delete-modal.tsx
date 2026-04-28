"use client";

import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

type AccountDeleteModalProps = {
  open: boolean;
  email: string;
  onClose: () => void;
};

export function AccountDeleteModal({ open, email, onClose }: AccountDeleteModalProps) {
  const [step, setStep] = useState<"intro" | "code" | "done">("intro");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { signOut } = useClerk();
  const router = useRouter();

  if (!open) return null;

  function close() {
    setStep("intro");
    setCode("");
    setMessage(null);
    onClose();
  }

  async function sendCode() {
    setSending(true);
    setMessage(null);
    const res = await fetch("/api/account/delete/send-code", { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    setSending(false);
    if (!res.ok) {
      setMessage(data.message ?? "인증번호 발송에 실패했습니다.");
      return;
    }
    setStep("code");
    setMessage(`${email}로 인증번호를 보냈습니다.`);
  }

  async function confirmDelete() {
    if (!/^\d{6}$/.test(code)) {
      setMessage("인증번호 6자리를 입력하세요.");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    const res = await fetch("/api/account/delete/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    setSubmitting(false);
    if (!res.ok) {
      setMessage(data.message ?? "탈퇴 처리에 실패했습니다.");
      return;
    }
    setStep("done");
  }

  async function finishAndLeave() {
    await signOut();
    router.push("/");
  }

  return (
    <div className="account-delete-modal-backdrop" onClick={close}>
      <div className="account-delete-modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="account-delete-modal-header">
          <h3>회원탈퇴</h3>
          {step !== "done" && (
            <button type="button" className="account-delete-modal-close" onClick={close} aria-label="닫기">×</button>
          )}
        </div>

        {step === "intro" && (
          <div className="account-delete-modal-body">
            <p className="account-delete-modal-desc">
              본인 확인을 위해 가입 이메일로 인증번호를 보내드립니다.
              <br />
              <strong>{email}</strong>
            </p>
            <p className="account-delete-modal-warn">
              회원탈퇴 시 작성한 게시글은 삭제되며, 7일간 임시 보관 후 영구 삭제됩니다.
              <br />
              7일 이내에 같은 이메일로 로그인하시면 복구할 수 있습니다.
            </p>
            {message && <div className="account-delete-modal-msg">{message}</div>}
            <div className="account-delete-modal-actions">
              <button type="button" className="account-delete-modal-cancel" onClick={close}>취소</button>
              <button type="button" className="account-delete-modal-primary" onClick={sendCode} disabled={sending}>
                {sending ? "발송 중..." : "인증번호 받기"}
              </button>
            </div>
          </div>
        )}

        {step === "code" && (
          <div className="account-delete-modal-body">
            <p className="account-delete-modal-desc">
              메일로 받은 6자리 인증번호를 입력하세요. (10분 유효)
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6자리 숫자"
              className="account-delete-modal-input"
            />
            {message && <div className="account-delete-modal-msg">{message}</div>}
            <div className="account-delete-modal-actions">
              <button type="button" className="account-delete-modal-cancel" onClick={close}>취소</button>
              <button type="button" className="account-delete-modal-primary danger" onClick={confirmDelete} disabled={submitting}>
                {submitting ? "처리 중..." : "회원탈퇴"}
              </button>
            </div>
            <button type="button" className="account-delete-modal-resend" onClick={sendCode} disabled={sending}>
              {sending ? "재발송 중..." : "인증번호 재발송"}
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="account-delete-modal-body">
            <p className="account-delete-modal-desc">
              회원탈퇴가 신청되었습니다.<br />
              7일 후 영구 삭제됩니다.<br />
              복구를 원하시면 7일 이내에 동일 이메일로 다시 로그인해 주세요.
            </p>
            <div className="account-delete-modal-actions">
              <button type="button" className="account-delete-modal-primary" onClick={finishAndLeave}>확인</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
