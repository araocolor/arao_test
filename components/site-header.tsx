"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Sparkles, MousePointerClick, Tag, BookOpen, Settings2, Users, CreditCard, MessageCircle, HelpCircle, LogOut, ShieldCheck, Camera } from "lucide-react";
import { useHeaderSessionStore } from "@/stores/header-session-store";
import { REVIEW_LIST_CACHE_TTL } from "@/lib/cache-config";

type SiteHeaderProps = {
  links: Array<{ href: string; label: string; icon?: string; divider?: boolean }>;
  action?: ReactNode;
  fullWidth?: boolean;
  brandHref?: string;
  onBrandClick?: () => void;
  leading?: ReactNode;
  mobileLeading?: ReactNode;
  mobileProfile?: ReactNode;
  mobileNotif?: ReactNode;
  mobileLogout?: ReactNode;
  mobileFooterLogout?: ReactNode;
  menuHeader?: string;
  isAdmin?: boolean;
  isSignedIn?: boolean;
  version?: number;
};

const REVIEW_PREFETCH_LOCK_KEY = "user-review-list-prefetch-lock";
const REVIEW_PREFETCH_LOCK_MS = 10000;

function canPrefetchReviewList(): boolean {
  if (typeof navigator === "undefined") return true;
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (!connection) return true;
  if (connection.saveData) return false;
  if (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g") return false;
  return true;
}

function isReviewPrefetchLocked(): boolean {
  try {
    const raw = sessionStorage.getItem(REVIEW_PREFETCH_LOCK_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < REVIEW_PREFETCH_LOCK_MS;
  } catch {
    return false;
  }
}

// 메뉴 항목별 아이콘
const MENU_ICONS: Record<string, ReactNode> = {
  "/arao": <Sparkles width={20} height={20} strokeWidth={1.7} />,
  "/gallery": <MousePointerClick width={20} height={20} strokeWidth={1.7} />,
  "/pricing": <Tag width={20} height={20} strokeWidth={1.7} />,
  "/manual": <BookOpen width={20} height={20} strokeWidth={1.7} />,
  "/user_review": <Users width={20} height={20} strokeWidth={1.7} />,
  "/account/general": <Settings2 width={20} height={20} strokeWidth={1.7} />,
};

export function SiteHeader({
  links,
  action,
  fullWidth = false,
  brandHref = "/",
  onBrandClick,
  leading,
  mobileLeading,
  mobileProfile,
  mobileNotif,
  mobileLogout,
  mobileFooterLogout,
  menuHeader,
  isAdmin,
  isSignedIn,
  version,
}: SiteHeaderProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [panelDragY, setPanelDragY] = useState(0);
  const drawerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const email = useHeaderSessionStore((state) => state.email);

  function handlePanelTouchStart(e: React.TouchEvent) {
    isDragging.current = true;
    touchStartY.current = e.touches[0].clientY;
    setPanelDragY(0);
  }

  function handlePanelTouchMove(e: React.TouchEvent) {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta < 0) return;
    setPanelDragY(delta);
  }

  function handlePanelTouchEnd() {
    isDragging.current = false;
    if (panelDragY > 80) {
      setProfilePanelOpen(false);
    }
    setPanelDragY(0);
  }

  // 드로어 열릴 때 body 스크롤 잠금 + 커뮤니티 prefetch
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
      // 커뮤니티 리스트 prefetch
      const cacheKey = "user-review-list-cache";
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { ts } = JSON.parse(cached) as { ts: number };
          if (Date.now() - ts < REVIEW_LIST_CACHE_TTL) return;
        }
      } catch {}
      if (!canPrefetchReviewList()) return;
      if (isReviewPrefetchLocked()) return;
      sessionStorage.setItem(REVIEW_PREFETCH_LOCK_KEY, String(Date.now()));
      fetch("/api/main/user-review?page=1&limit=20&sort=latest")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          sessionStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));
        })
        .catch(() => {})
        .finally(() => {
          sessionStorage.removeItem(REVIEW_PREFETCH_LOCK_KEY);
        });
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const closeDrawer = () => { setDrawerOpen(false); setProfilePanelOpen(false); };

  return (
    <>
      <header className={fullWidth ? "header header-full" : "header"}>
        <div className={fullWidth ? "header-inner" : "header-inner-inline"}>
          <button
            aria-expanded={drawerOpen}
            aria-label="Open menu"
            className="header-menu-toggle"
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
          >
            <span className="header-menu-toggle-lines">
              <span />
              <span />
              <span />
            </span>
          </button>
          <Link className="brand" href={brandHref} onClick={onBrandClick}>
            <Image src="/logo.svg" alt="ARAO logo" width={80} height={28} priority />
          </Link>
          <div className="header-actions">
            <nav className="nav">
              {links.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
            {action}
            {leading}
          </div>
          <div className="header-mobile-actions">
            {mobileNotif}
          </div>
        </div>
      </header>

      {/* 드로어 */}
      <div
        className={`nav-drawer-backdrop${drawerOpen ? " is-open" : ""}`}
        onClick={closeDrawer}
        aria-hidden="true"
      />
      <div
        ref={drawerRef}
        className={`nav-drawer${drawerOpen ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="메뉴"
      >
        {/* 드로어 헤더 */}
        <div className="nav-drawer-header">
          <Link href={brandHref} className="nav-drawer-logo" onClick={closeDrawer}>
            <Image src="/logo.svg" alt="ARAO" width={72} height={26} />
          </Link>
          <button
            type="button"
            className="nav-drawer-close"
            onClick={closeDrawer}
            aria-label="닫기"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 메뉴 목록 */}
        <nav className="nav-drawer-list">
          {links.map((link) => (
            <div key={link.href}>
              {link.divider && <hr className="nav-drawer-divider" />}
              <Link
                href={link.href}
                className="nav-drawer-link"
                onClick={closeDrawer}
              >
                <span className="nav-drawer-icon" aria-hidden="true">
                  {MENU_ICONS[link.href] ?? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  )}
                </span>
                {link.label}
              </Link>
            </div>
          ))}
        </nav>

        {/* 사용자 서브패널 */}
        <div
          ref={panelRef}
          className={`nav-drawer-profile-panel${profilePanelOpen ? " is-open" : ""}`}
          onTouchStart={handlePanelTouchStart}
          onTouchMove={handlePanelTouchMove}
          onTouchEnd={handlePanelTouchEnd}
          style={{
            transform: panelDragY > 0 ? `translateY(${panelDragY}px)` : undefined,
            transition: isDragging.current ? "none" : "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
          }}
        >
          <div className="nav-drawer-profile-panel-handle" onClick={() => setProfilePanelOpen(false)}>
            <span className="nav-drawer-profile-panel-handle-bar" />
          </div>
          <div className="nav-drawer-profile-panel-email">{email ?? ""}</div>
          <nav className="nav-drawer-list">
            <Link href="/account/general" className="nav-drawer-link" onClick={closeDrawer}>
              <span className="nav-drawer-icon"><Settings2 width={20} height={20} strokeWidth={1.7} /></span>
              사용자설정
            </Link>
            <Link href="/user_review?board=arao" className="nav-drawer-link" onClick={closeDrawer}>
              <span className="nav-drawer-icon"><Camera width={20} height={20} strokeWidth={1.7} /></span>
              아라오사진
            </Link>
            <Link href="/account/orders" className="nav-drawer-link" onClick={closeDrawer}>
              <span className="nav-drawer-icon"><CreditCard width={20} height={20} strokeWidth={1.7} /></span>
              구매프로파일
            </Link>
            <Link href="/account/consulting" className="nav-drawer-link" onClick={closeDrawer}>
              <span className="nav-drawer-icon"><MessageCircle width={20} height={20} strokeWidth={1.7} /></span>
              이용문의
            </Link>
            <Link href="/user_review?board=qna" className="nav-drawer-link" onClick={closeDrawer}>
              <span className="nav-drawer-icon"><HelpCircle width={20} height={20} strokeWidth={1.7} /></span>
              도움말
            </Link>
            {isAdmin && (
              <Link href="/admin" className="nav-drawer-link" onClick={closeDrawer}>
                <span className="nav-drawer-icon"><ShieldCheck width={20} height={20} strokeWidth={1.7} /></span>
                관리자
              </Link>
            )}
            <hr className="nav-drawer-divider" />
            <div className="nav-drawer-logout-wrap" onClick={closeDrawer}>
              <span className="nav-drawer-icon"><LogOut width={20} height={20} strokeWidth={1.7} /></span>
              {mobileLogout}
            </div>
          </nav>
        </div>

        {/* 하단 로그인/로그아웃 */}
        <div className="nav-drawer-footer" onClick={!isSignedIn ? () => { window.location.href = "/sign-in"; } : undefined} style={!isSignedIn ? { cursor: "pointer" } : undefined}>
          <div className="nav-drawer-footer-row">
            <button
              type="button"
              className="nav-drawer-avatar-btn"
              onClick={() => {
                if (isSignedIn) {
                  setProfilePanelOpen((v) => !v);
                } else {
                  window.location.href = "/sign-in";
                }
              }}
              aria-label="사용자 메뉴"
            >
              {mobileProfile}
            </button>
            {mobileFooterLogout}
            {mobileLeading ?? leading}
            {!isSignedIn && version !== undefined && version % 2 === 0 && (
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginLeft: "auto" }}>배포완료</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
