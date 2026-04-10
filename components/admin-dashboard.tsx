"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { LandingContent } from "@/lib/landing-content";
import { AdminContentManager } from "@/components/admin-content-manager";
import { AdminPricingManager } from "@/components/admin-pricing-manager";
import { AdminConsultingManager } from "@/components/admin-consulting-manager";
import { AdminCommitListPage } from "@/components/admin-commit-list-page";

const MOBILE_DRAWER_CLOSE_MS = 280;

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
  const [activeSectionId, setActiveSectionId] = useState(adminSections[0].id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSection =
    adminSections.find((section) => section.id === activeSectionId) ?? adminSections[0];

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
    document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const openMenu = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setMenuMounted(true);
    setMenuOpen(true);
  };

  const closeMenu = () => {
    setMenuOpen(false);
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      setMenuMounted(false);
      closeTimerRef.current = null;
    }, MOBILE_DRAWER_CLOSE_MS);
  };

  const selectSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="admin-layout admin-layout-root">
      <button
        aria-expanded={menuOpen}
        aria-label="관리 메뉴 열기"
        className={menuOpen ? "admin-mobile-menu-toggle is-hidden" : "admin-mobile-menu-toggle"}
        type="button"
        onClick={() => (menuOpen ? closeMenu() : openMenu())}
      >
        <span />
        <span />
        <span />
      </button>

      {menuMounted ? (
        <div
          className={`admin-nav-drawer-backdrop${menuOpen ? " is-open" : ""}`}
          onClick={() => closeMenu()}
          role="presentation"
          aria-hidden="true"
        >
          <aside
            className={`admin-nav-drawer${menuOpen ? " is-open" : ""}`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="관리 메뉴"
          >
            <div className="admin-nav-drawer-header">
              <Link href="/" className="admin-nav-drawer-logo" onClick={() => closeMenu()}>
                <Image src="/logo.svg" alt="ARAO" width={72} height={26} />
              </Link>
              <button
                type="button"
                className="admin-nav-drawer-close"
                onClick={closeMenu}
                aria-label="닫기"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <nav className="admin-nav-drawer-list">
              <Link className="admin-nav-drawer-link" href="/" onClick={() => closeMenu()}>
                1. Home
              </Link>
              {adminSections.map((section, sectionIndex) => (
                <button
                  key={`mobile-${section.id}`}
                  className={section.id === activeSectionId ? "admin-nav-drawer-link admin-mobile-nav-button is-active" : "admin-nav-drawer-link admin-mobile-nav-button"}
                  type="button"
                  onClick={() => {
                    selectSection(section.id);
                    closeMenu();
                  }}
                >
                  {`${sectionIndex + 2}. ${section.menu}`}
                </button>
              ))}
            </nav>

            <div className="admin-nav-drawer-footer" />
          </aside>
        </div>
      ) : null}

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

      <div className="admin-panel stack" onClick={() => (menuOpen ? closeMenu() : null)}>
        <div className="admin-panel-card stack">
          <p className="muted">{activeSection.eyebrow}</p>
          <h2>{activeSection.title}</h2>
          <p className="muted">{activeSection.description}</p>

          {activeSection.id === "gallery" ? (
            <AdminContentManager key="gallery" initialContent={landingContent} view="gallery" />
          ) : activeSection.id === "landing" ? (
            <AdminContentManager key="landing" initialContent={landingContent} view="landing" />
          ) : activeSection.id === "pricing" ? (
            <AdminPricingManager key="pricing" initialContent={landingContent} />
          ) : activeSection.id === "consulting" ? (
            <AdminConsultingManager key="consulting" />
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
