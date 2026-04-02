"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type SiteHeaderProps = {
  links: Array<{ href: string; label: string; icon?: string; divider?: boolean }>;
  action?: ReactNode;
  fullWidth?: boolean;
  leading?: ReactNode;
  mobileLeading?: ReactNode;
  mobileProfile?: ReactNode;
  mobileLogout?: ReactNode;
  menuHeader?: string;
};

// 메뉴 항목별 라인 아이콘 SVG
const MENU_ICONS: Record<string, ReactNode> = {
  "/arao": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  ),
  "/gallery": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  "/pricing": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  "/manual": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  ),
  "/user_review": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
  "/account/general": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
};

export function SiteHeader({
  links,
  action,
  fullWidth = false,
  leading,
  mobileLeading,
  mobileProfile,
  mobileLogout,
  menuHeader,
}: SiteHeaderProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // 드로어 열릴 때 body 스크롤 잠금
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const closeDrawer = () => setDrawerOpen(false);

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
          <Link className="brand" href="/">
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
            {mobileProfile}
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
          <Link href="/" className="nav-drawer-logo" onClick={closeDrawer}>
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

        {/* 하단 로그인/로그아웃 */}
        <div className="nav-drawer-footer">
          {mobileLogout}
          {mobileLeading ?? leading}
        </div>
      </div>
    </>
  );
}
