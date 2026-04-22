"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LandingContent } from "@/lib/landing-content";
import { AdminContentManager } from "@/components/admin-content-manager";
import { AdminPricingManager } from "@/components/admin-pricing-manager";
import { AdminConsultingManager } from "@/components/admin-consulting-manager";
import { AdminCommitListPage } from "@/components/admin-commit-list-page";

const adminSections = [
  {
    id: "landing",
    menu: "랜딩페이지",
    eyebrow: "Landing",
    title: "랜딩페이지",
    description: "Hero, Before/After, 리뷰, YouTube, 푸터 섹션을 수정합니다.",
  },
  {
    id: "gallery",
    menu: "갤러리 관리",
    eyebrow: "Gallery",
    title: "갤러리 관리",
    description: "카테고리별 Before / After 이미지, 제목, 문구, 촬영 정보를 관리합니다.",
  },
  {
    id: "pricing",
    menu: "상품가격",
    eyebrow: "Pricing",
    title: "상품가격 관리",
    description: "pricing 페이지의 상단 소개와 각 요금 카드 내용을 Supabase와 연결해서 수정합니다.",
  },
  {
    id: "consulting",
    menu: "상담/문의",
    eyebrow: "Consulting",
    title: "상담 및 문의 관리",
    description: "사용자가 제출한 1:1 상담과 일반 문의를 확인하고 답변을 관리합니다.",
  },
  {
    id: "members",
    menu: "회원 관리",
    eyebrow: "Members",
    title: "회원 관리",
    description: "Clerk 계정과 Supabase profiles 테이블을 기준으로 관리자, 일반 사용자, 운영 담당자 역할을 구분합니다.",
    items: ["Clerk 사용자 조회", "profiles role 관리", "관리자 계정 승인 흐름"],
  },
  {
    id: "orders",
    menu: "주문 관리",
    eyebrow: "Orders",
    title: "주문 관리",
    description: "orders, order_items, payments 구조를 기준으로 주문 생성부터 결제 완료 이후 상태 변경까지 확인합니다.",
    items: ["주문 목록", "주문 상태 추적", "결제 실패/취소 처리"],
  },
  {
    id: "sales",
    menu: "매출 관리",
    eyebrow: "Sales",
    title: "매출 관리",
    description: "결제 완료 기준으로 매출을 집계하고 환불과 취소는 별도로 분리해서 관리할 수 있도록 확장합니다.",
    items: ["매출 집계", "환불 분리", "기간별 리포트"],
  },
  {
    id: "auth",
    menu: "인증 관리",
    eyebrow: "Auth",
    title: "인증 관리",
    description: "로그인, 관리자 접근 제어, 역할 기반 권한 흐름을 이 영역에서 계속 확장할 수 있습니다.",
    items: ["로그인 정책", "관리자 접근 제한", "역할 기반 권한 체크"],
  },
  {
    id: "commit-list",
    menu: "커밋내역",
    eyebrow: "Commit List",
    title: "커밋내역",
    description: "커밋 내역과 보고서, 메모를 확인합니다.",
  },
];

type AdminDashboardProps = {
  email: string;
  role: string;
  landingContent: LandingContent;
};

export function AdminDashboard({ email, role, landingContent }: AdminDashboardProps) {
  const [activeSectionId, setActiveSectionId] = useState("consulting");
  const [isConsultingDetail, setIsConsultingDetail] = useState(false);
  const [consultingBackToken, setConsultingBackToken] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const activeSection =
    adminSections.find((section) => section.id === activeSectionId) ?? adminSections[0];
  const isCommitSection = activeSection.id === "commit-list";
  const isConsultingSection = activeSection.id === "consulting";
  const panelCardClassName = !hydrated || isCommitSection
    ? "admin-panel-card stack"
    : `admin-panel-card stack admin-panel-card-font-reduced${isConsultingSection ? " admin-panel-card-no-padding" : ""}`;

  useEffect(() => {
    setHydrated(true);
  }, []);

  const selectSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    if (sectionId !== "consulting") {
      setIsConsultingDetail(false);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleMobileBack = () => {
    if (activeSectionId === "consulting" && isConsultingDetail) {
      setConsultingBackToken((prev) => prev + 1);
      return;
    }

    if (typeof window !== "undefined") {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "/";
      }
    }
  };

  return (
    <div className="admin-layout admin-layout-root">
      <aside className="admin-sidebar admin-sidebar-root">
        <p className="admin-sidebar-title">관리 메뉴</p>
        <div className="admin-sidebar-top">
          <Link className="admin-menu-link admin-menu-link-home" href="/">
            <span className="admin-home-link-content">Home</span>
          </Link>
        </div>
        <div className="admin-menu-list">
          {adminSections.map((section) => (
            <button
              key={section.id}
              className={section.id === activeSectionId ? "admin-menu-item active" : "admin-menu-item"}
              type="button"
              onClick={() => selectSection(section.id)}
            >
              {section.menu}
            </button>
          ))}
        </div>
        <div className="admin-sidebar-bottom" />
      </aside>

      <div className="admin-panel stack">
        <div className="admin-mobile-top-dropdown-wrap">
          <div className="admin-mobile-top-dropdown-inner">
            {activeSectionId === "consulting" ? (
              <button
                type="button"
                className="admin-consulting-btn-back admin-mobile-header-back-btn"
                onClick={handleMobileBack}
                aria-label="컨설팅 목록으로 돌아가기"
              >
                {"<"}
              </button>
            ) : null}

            <select
              aria-label="관리자 메뉴 선택"
              className="admin-mobile-top-dropdown-select"
              value={activeSectionId}
              onChange={(event) => selectSection(event.target.value)}
            >
              {adminSections.map((section) => (
                <option key={`top-${section.id}`} value={section.id}>
                  {section.menu}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={panelCardClassName}>
          {activeSection.id !== "landing" && activeSection.id !== "gallery" && activeSection.id !== "consulting" ? (
            <>
              <p className="muted">{activeSection.eyebrow}</p>
              <h2>{activeSection.title}</h2>
              <p className="muted">{activeSection.description}</p>
            </>
          ) : null}

          {activeSection.id === "gallery" ? (
            <AdminContentManager key="gallery" initialContent={landingContent} view="gallery" />
          ) : activeSection.id === "landing" ? (
            <AdminContentManager key="landing" initialContent={landingContent} view="landing" />
          ) : activeSection.id === "pricing" ? (
            <AdminPricingManager key="pricing" initialContent={landingContent} />
          ) : activeSection.id === "consulting" ? (
            <AdminConsultingManager
              key="consulting"
              onDetailViewChange={setIsConsultingDetail}
              forceListToken={consultingBackToken}
            />
          ) : activeSection.id === "commit-list" ? (
            <AdminCommitListPage key="commit-list" embedded />
          ) : (
            <div className="admin-checklist">
              {activeSection.items?.map((item) => (
                <div key={item} className="admin-check-item">
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
