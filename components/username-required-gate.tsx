"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type UsernameRequiredGateProps = {
  message?: string;
  redirectTo?: string;
};

export function UsernameRequiredGate({
  message = "아이디를 등록 하시겠습니까?",
  redirectTo = "/account/general",
}: UsernameRequiredGateProps) {
  const router = useRouter();
  const askedRef = useRef(false);

  useEffect(() => {
    if (askedRef.current) return;
    askedRef.current = true;

    const ok = window.confirm(message);
    if (ok) {
      router.push(redirectTo);
      return;
    }

    // 브라우저 정책상 close가 실패할 수 있어 back으로 폴백
    window.close();
    setTimeout(() => {
      if (window.history.length > 1) {
        router.back();
      } else {
        router.push("/account");
      }
    }, 80);
  }, [message, redirectTo, router]);

  return (
    <div className="admin-panel-card stack account-section-card page-slide-down">
      <h2>사용자프로파일</h2>
      <p className="muted">아이디 등록 후 이용 가능합니다.</p>
    </div>
  );
}
