"use client";

import { useEffect, useState } from "react";

export function useAdminPendingCount(isSignedIn: boolean) {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!isSignedIn) {
      setPendingCount(0);
      return;
    }

    async function fetchPendingCount() {
      try {
        const response = await fetch("/api/admin/consulting/pending-count");
        if (response.ok) {
          const data = (await response.json()) as { pendingCount: number };
          setPendingCount(data.pendingCount);
        } else {
          // 403 또는 401이면 관리자가 아님
          setPendingCount(0);
        }
      } catch (error) {
        console.error("Failed to fetch pending count:", error);
      }
    }

    // 초기 로드
    fetchPendingCount();

    // 60초마다 폴링
    const interval = setInterval(fetchPendingCount, 60000);

    // 탭 활성화 시 즉시 업데이트
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchPendingCount();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isSignedIn]);

  return pendingCount;
}
