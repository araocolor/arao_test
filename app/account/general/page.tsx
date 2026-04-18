"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { GeneralSettingsForm } from "@/components/general-settings-form";
import { getCached, setCached } from "@/hooks/use-prefetch-cache";
import { useReviewsPrefetch } from "@/hooks/use-reviews-prefetch";

interface GeneralData {
  email: string;
  fullName: string | null;
  username: string | null;
  hasPassword: boolean;
  phone: string | null;
  notificationEnabled?: boolean;
  iconImage?: string;
  role: string;
  createdAt: string;
  usernameChangeCount?: number;
  usernameRegisteredAt?: string | null;
}

function getGeneralCacheKey(email?: string | null) {
  return email ? `general_${email.toLowerCase()}` : "general";
}

export default function AccountGeneralPage() {
  useReviewsPrefetch();
  const { user } = useUser();
  const [data, setData] = useState<GeneralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const signedInEmail =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    null;
  const generalCacheKey = getGeneralCacheKey(signedInEmail);

  useEffect(() => {
    async function loadData() {
      let hasCached = false;
      try {
        // 1. 캐시된 데이터 확인
        const cachedData = getCached<GeneralData>(generalCacheKey);
        if (cachedData) {
          setData(cachedData);
          hasCached = true;
          setLoading(false);
        }

        // 2. 항상 API로 최신 사용자 값 동기화 (사용자 전환 시 캐시 오염 방지)
        const res = await fetch("/api/account/general");
        if (!res.ok) throw new Error("Failed to fetch general data");

        const generalData = await res.json();
        setData(generalData);
        setCached(generalCacheKey, generalData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!hasCached) {
          setLoading(false);
        }
      }
    }

    loadData();
  }, [generalCacheKey]);

  if (loading) {
    return (
      <div className="account-panel-card stack account-section-card page-slide-down">
        <p className="muted">로딩 중...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="account-panel-card stack account-section-card page-slide-down">
        <h1>오류</h1>
        <p className="muted">{error || "프로필 정보를 불러올 수 없습니다."}</p>
      </div>
    );
  }

  return (
    <div className="page-slide-down">
      <GeneralSettingsForm
        email={data.email}
        fullName={data.fullName}
        username={data.username}
        hasPassword={data.hasPassword}
        phone={data.phone}
        notificationEnabled={data.notificationEnabled ?? true}
        iconImage={data.iconImage}
        role={data.role}
        createdAt={data.createdAt}
        usernameChangeCount={data.usernameChangeCount ?? 0}
        usernameRegisteredAt={data.usernameRegisteredAt ?? null}
      />
    </div>
  );
}
