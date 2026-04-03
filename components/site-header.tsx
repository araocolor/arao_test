"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  SparklesIcon,
  CursorArrowRippleIcon,
  TagIcon,
  BookOpenIcon,
  ChatBubbleLeftIcon,
  Cog6ToothIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

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

const REVIEW_LIST_CACHE_TTL = 300000; // 5분
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

// 메뉴 항목별 Heroicons
const MENU_ICONS: Record<string, ReactNode> = {
  "/arao": <SparklesIcon width={20} height={20} strokeWidth={1.7} />,
  "/gallery": <CursorArrowRippleIcon width={20} height={20} strokeWidth={1.7} />,
  "/pricing": <TagIcon width={20} height={20} strokeWidth={1.7} />,
  "/manual": <BookOpenIcon width={20} height={20} strokeWidth={1.7} />,
  "/user_review": <UsersIcon width={20} height={20} strokeWidth={1.7} />,
  "/account/general": <Cog6ToothIcon width={20} height={20} strokeWidth={1.7} />,
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
