"use client";

import { useEffect, useState } from "react";
import { GeneralSettingsForm } from "@/components/general-settings-form";
import { getCached, setCached } from "@/hooks/use-prefetch-cache";
import { useReviewsPrefetch } from "@/hooks/use-reviews-prefetch";

interface GeneralData {
  email: string;
  fullName: string | null;
  username: string | null;
  hasPassword: boolean;
  phone: string | null;
  iconImage?: string;
  role: string;
  createdAt: string;
}

export default function AccountGeneralPage() {
  useReviewsPrefetch();
  const [data, setData] = useState<GeneralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        // 1. 캐시된 데이터 확인
        const cachedData = getCached<GeneralData>("general");
        if (cachedData) {
          setData(cachedData);
          setLoading(false);
          return;
        }

        // 2. 캐시 없으면 API 호출
        const res = await fetch("/api/account/general");
        if (!res.ok) throw new Error("Failed to fetch general data");

        const generalData = await res.json();
        setData(generalData);
        setCached("general", generalData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="admin-panel-card stack account-section-card">
        <p className="muted">로딩 중...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="admin-panel-card stack">
        <h1>오류</h1>
        <p className="muted">{error || "프로필 정보를 불러올 수 없습니다."}</p>
      </div>
    );
  }

  return (
    <div className="admin-panel-card stack account-section-card">
      <GeneralSettingsForm
        email={data.email}
        fullName={data.fullName}
        username={data.username}
        hasPassword={data.hasPassword}
        phone={data.phone}
        iconImage={data.iconImage}
        role={data.role}
        createdAt={data.createdAt}
      />
    </div>
  );
}
