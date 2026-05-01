"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useClerk } from "@clerk/nextjs";
import { Sparkles, MousePointerClick, Tag, BookOpen, Settings2, Users, CreditCard, MessageCircle, HelpCircle, ShieldCheck, LogOut } from "lucide-react";
import { TierBadge } from "@/components/tier-badge";
import { UserProfileModal, type UserProfileModalTarget } from "@/components/user-profile-modal";
import { useHeaderSessionStore } from "@/stores/header-session-store";
import { REVIEW_LIST_CACHE_TTL } from "@/lib/cache-config";
import { clearAllCachesOnLogout, getCached, setCached } from "@/hooks/use-prefetch-cache";

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
  hideOnScrollMode?: "default" | "terms";
};

const REVIEW_PREFETCH_LOCK_KEY = "user-review-list-prefetch-lock";
const REVIEW_PREFETCH_LOCK_MS = 10000;
const SETTINGS_PATH = "/account/general";
const SIGN_IN_WITH_SETTINGS_REDIRECT = "/sign-in?redirect_url=%2Faccount%2Fgeneral";
const LOADER_GENERAL_CACHE_KEY = "loader-account-general";

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

function resolveMenuHref(href: string, isSignedIn?: boolean): string {
  if (href === SETTINGS_PATH && !isSignedIn) {
    return SIGN_IN_WITH_SETTINGS_REDIRECT;
  }
  return href;
}

// 메뉴 항목별 아이콘
const MENU_ICONS: Record<string, ReactNode> = {
  "/about": <Sparkles width={20} height={20} strokeWidth={1.7} />,
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
  hideOnScrollMode = "default",
}: SiteHeaderProps) {
  const { signOut } = useClerk();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [avatarToastVisible, setAvatarToastVisible] = useState(false);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [profileModalTarget, setProfileModalTarget] = useState<UserProfileModalTarget | null>(null);
  const [profileModalBio, setProfileModalBio] = useState<string | null>(null);
  const [hideOnScroll, setHideOnScroll] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const lastScrollYRef = useRef(0);
  const lastScrollTsRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);
  const username = useHeaderSessionStore((state) => state.username);
  const usernameReady = useHeaderSessionStore((state) => state.usernameReady);
  const avatar = useHeaderSessionStore((state) => state.avatar);
  const email = useHeaderSessionStore((state) => state.email);
  const role = useHeaderSessionStore((state) => state.role);
  const tier = useHeaderSessionStore((state) => state.tier);
  const hasUsername = !!(username && username.trim().length > 0);

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

  // 아바타 미등록 안내 토스트: 드로어 열림 1초 후 표시, 2초 후 숨김
  useEffect(() => {
    if (!drawerOpen || !isSignedIn || avatar || !hasUsername) {
      setAvatarToastVisible(false);
      return;
    }
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const showTimer = setTimeout(() => {
      setAvatarToastVisible(true);
      hideTimer = setTimeout(() => setAvatarToastVisible(false), 5000);
    }, 1000);
    return () => {
      clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [drawerOpen, isSignedIn, avatar, hasUsername]);

  // 햄버거 드로어 열릴 때 account/general 프리캐싱: 캐시 없고 아이디·아바타 중 하나라도 없을 때
  useEffect(() => {
    if (!drawerOpen || !isSignedIn) return;
    if (hasUsername && avatar) return;
    if (getCached("account-general")) return;
    void fetch("/api/account/general")
      .then((r) => r.ok ? r.json() : null)
      .then((data: unknown) => {
        if (data) setCached("account-general", data);
      });
  }, [drawerOpen, isSignedIn, hasUsername, avatar]);

  // 헤더 숨김 로직: 기본(default) / terms 스타일(빠른 상향 스크롤에서만 표시)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(min-width: 820px)");
    const defaultMinDelta = 6;
    const defaultMinScrollTop = 72;
    const termsShowTopY = 12;
    const termsHideDownDelta = 4;
    const termsFastUpwardSpeed = 2.0; // px/ms

    const applyByScroll = () => {
      const currentY = window.scrollY;
      const nowTs = performance.now();

      if (!fullWidth || drawerOpen || profilePanelOpen) {
        setHideOnScroll(false);
        lastScrollYRef.current = currentY;
        lastScrollTsRef.current = nowTs;
        return;
      }

      if (hideOnScrollMode === "terms") {
        const deltaY = currentY - lastScrollYRef.current;
        const elapsedMs = Math.max(1, nowTs - lastScrollTsRef.current);
        const upwardSpeed = deltaY < 0 ? Math.abs(deltaY) / elapsedMs : 0;

        if (currentY <= termsShowTopY) {
          setHideOnScroll(false);
        } else if (deltaY > termsHideDownDelta) {
          setHideOnScroll(true);
        } else if (deltaY < 0 && upwardSpeed >= termsFastUpwardSpeed) {
          setHideOnScroll(false);
        }
      } else {
        if (!mediaQuery.matches) {
          setHideOnScroll(false);
          lastScrollYRef.current = currentY;
          lastScrollTsRef.current = nowTs;
          return;
        }

        const delta = currentY - lastScrollYRef.current;
        if (currentY <= defaultMinScrollTop || delta < -defaultMinDelta) {
          setHideOnScroll(false);
        } else if (delta > defaultMinDelta) {
          setHideOnScroll(true);
        }
      }

      lastScrollYRef.current = currentY;
      lastScrollTsRef.current = nowTs;
    };

    const onScroll = () => {
      if (scrollRafRef.current !== null) return;
      scrollRafRef.current = window.requestAnimationFrame(() => {
        scrollRafRef.current = null;
        applyByScroll();
      });
    };

    const onResize = () => {
      applyByScroll();
    };

    lastScrollYRef.current = window.scrollY;
    lastScrollTsRef.current = performance.now();
    applyByScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [drawerOpen, fullWidth, hideOnScrollMode, profilePanelOpen]);

  const closeDrawer = () => {
    setDrawerOpen(false);
    setProfilePanelOpen(false);
  };
  const handleLogout = () => {
    closeDrawer();
    clearAllCachesOnLogout();
    void signOut().then(() => { window.location.href = "/"; });
  };
  const handleTopProfileClick = () => {
    closeDrawer();
    window.location.href = isSignedIn ? "/account/general" : "/sign-in";
  };
  const handleDrawerAvatarClick = () => {
    if (!isSignedIn) {
      closeDrawer();
      window.location.href = "/sign-in";
      return;
    }

    const fallbackAuthorId = (username && username.trim().length > 0)
      ? username.trim()
      : (email ? email.split("@")[0] : "회원");

    setProfileModalTarget({
      authorId: fallbackAuthorId,
      authorEmail: email ?? null,
      authorTier: tier ?? null,
      iconImage: avatar ?? null,
    });

    const loaderCached = getCached<{
      bio?: string | null;
      username?: string | null;
      email?: string | null;
      tier?: string | null;
      iconImage?: string | null;
    }>(LOADER_GENERAL_CACHE_KEY);
    const cached = loaderCached ?? getCached<{
      bio?: string | null;
      username?: string | null;
      email?: string | null;
      tier?: string | null;
      iconImage?: string | null;
    }>("account-general");

    if (cached) {
      setProfileModalBio(cached.bio ?? null);
      setProfileModalTarget((prev) => prev ? {
        authorId: cached.username?.trim() || prev.authorId,
        authorEmail: cached.email ?? prev.authorEmail ?? null,
        authorTier: cached.tier ?? prev.authorTier ?? null,
        iconImage: cached.iconImage ?? prev.iconImage ?? null,
      } : prev);
    } else {
      setProfileModalBio(null);
    }

    void fetch("/api/account/general")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: {
        bio?: string | null;
        username?: string | null;
        email?: string | null;
        tier?: string | null;
        iconImage?: string | null;
      } | null) => {
        if (!data) return;
        setCached("account-general", data);
        setProfileModalBio(data.bio ?? null);
        setProfileModalTarget((prev) => prev ? {
          authorId: data.username?.trim() || prev.authorId,
          authorEmail: data.email ?? prev.authorEmail ?? null,
          authorTier: data.tier ?? prev.authorTier ?? null,
          iconImage: data.iconImage ?? prev.iconImage ?? null,
        } : prev);
      })
      .catch(() => {});
  };
  const saveProfileBioFromHeader = async (nextBio: string): Promise<{ ok: boolean; message?: string; bio?: string }> => {
    const response = await fetch("/api/account/general", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "bio", bio: nextBio }),
    });
    const data = (await response.json()) as { message?: string; bio?: string | null };

    if (!response.ok) {
      return { ok: false, message: data.message ?? "자기소개 저장 중 오류가 발생했습니다." };
    }

    const saved = (data.bio ?? "").toString();
    setProfileModalBio(saved);
    const cached = getCached<Record<string, unknown>>("account-general") ?? {};
    setCached("account-general", { ...cached, bio: saved });
    return { ok: true, bio: saved };
  };
  const shouldHideHeader = fullWidth && hideOnScroll;
  const hideClassName = hideOnScrollMode === "terms" ? "header-scroll-hidden-terms" : "header-scroll-hidden";
  const shouldShowAvatarRegisterCta = !!isSignedIn && hasUsername && !avatar;
  const avatarRegisterCta = (
    <div
      style={{
        padding: "0 20px 8px",
        display: "flex",
        justifyContent: "center",
        transform: avatarToastVisible ? "translateY(0)" : "translateY(20px)",
        opacity: avatarToastVisible ? 1 : 0,
        transition: "transform 0.4s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.4s ease-out",
        pointerEvents: avatarToastVisible ? "auto" : "none",
      }}
    >
      <Link
        href="/account/general"
        onClick={closeDrawer}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          height: 40,
          padding: "0 18px",
          fontSize: 14,
          fontWeight: 700,
          color: "#fff",
          background: "rgba(17, 17, 17, 0.8)",
          borderRadius: 999,
          textDecoration: "none",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}
      >
        프로필 사진 등록
      </Link>
    </div>
  );

  return (
    <>
      <header className={shouldHideHeader ? `header header-full ${hideClassName}` : (fullWidth ? "header header-full" : "header")}>
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
                <Link key={link.href} href={resolveMenuHref(link.href, isSignedIn)}>
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
          {!isSignedIn ? (
            <button
              type="button"
              className="nav-drawer-login-pill"
              onClick={() => { closeDrawer(); window.location.href = "/sign-in"; }}
            >
              로그인
            </button>
          ) : isSignedIn && usernameReady ? (
            <button
              type="button"
              className="nav-drawer-profile-trigger"
              onClick={handleTopProfileClick}
              aria-label="사용자 메뉴"
            >
              <span
                className="nav-drawer-avatar-icon"
                data-tier={tier ?? undefined}
                role="button"
                tabIndex={0}
                aria-label="회원정보 모달 열기"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDrawerAvatarClick();
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  e.stopPropagation();
                  handleDrawerAvatarClick();
                }}
              >
                {mobileProfile}
              </span>
              <span className="nav-drawer-avatar-meta">
                <span className="nav-drawer-avatar-label">
                  {hasUsername ? (username as string) : <span className="nav-drawer-register-id">아이디등록</span>}
                  <TierBadge tier={tier} size={18} />
                </span>
                {email && <span className="nav-drawer-avatar-email">{email}</span>}
                {role && <span className="nav-drawer-avatar-role" data-role={role}>{role}</span>}
              </span>
            </button>
          ) : (
            <span />
          )}
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
          {links.map((link) => {
            const isSettingsAccordionTrigger = link.href === SETTINGS_PATH && isSignedIn;
            const resolvedHref = resolveMenuHref(link.href, isSignedIn);
            return (
              <div key={link.href}>
                {link.divider && <hr className="nav-drawer-divider" />}
                <Link
                  href={resolvedHref}
                  className={`nav-drawer-link${isSettingsAccordionTrigger ? " nav-drawer-link-settings" : ""}`}
                  aria-expanded={isSettingsAccordionTrigger ? profilePanelOpen : undefined}
                  aria-controls={isSettingsAccordionTrigger ? "nav-drawer-settings-accordion" : undefined}
                  onClick={(e) => {
                    if (isSettingsAccordionTrigger) {
                      e.preventDefault();
                      setProfilePanelOpen((v) => !v);
                    } else {
                      closeDrawer();
                    }
                  }}
                >
                  <span className="nav-drawer-link-main">
                    <span className="nav-drawer-icon" aria-hidden="true">
                      {MENU_ICONS[link.href] ?? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="9" />
                        </svg>
                      )}
                    </span>
                    {link.label}
                  </span>
                  {isSettingsAccordionTrigger && (
                    <span className={`nav-drawer-settings-toggle${profilePanelOpen ? " is-open" : ""}`} aria-hidden="true">+</span>
                  )}
                </Link>
                {isSettingsAccordionTrigger && (
                  <div id="nav-drawer-settings-accordion" className={`nav-drawer-settings-accordion${profilePanelOpen ? " is-open" : ""}`}>
                    <nav className="nav-drawer-settings-links" aria-label="설정 세부 메뉴">
                      <Link href="/account/general" className="nav-drawer-sub-link" onClick={closeDrawer}>
                        <span className="nav-drawer-icon"><Settings2 width={18} height={18} strokeWidth={1.7} /></span>
                        개인설정
                      </Link>
                      <Link href="/account/consulting" className="nav-drawer-sub-link" onClick={closeDrawer}>
                        <span className="nav-drawer-icon"><MessageCircle width={18} height={18} strokeWidth={1.7} /></span>
                        상담/문의
                      </Link>
                      <Link href="/account/orders" className="nav-drawer-sub-link" onClick={closeDrawer}>
                        <span className="nav-drawer-icon"><CreditCard width={18} height={18} strokeWidth={1.7} /></span>
                        주문관리
                      </Link>
                      <Link href="/account/mycolor" className="nav-drawer-sub-link" onClick={closeDrawer}>
                        <span className="nav-drawer-icon"><BookOpen width={18} height={18} strokeWidth={1.7} /></span>
                        컬러레시피
                      </Link>
                      <button type="button" className="nav-drawer-sub-link nav-drawer-sub-button" onClick={handleLogout}>
                        <span className="nav-drawer-icon"><LogOut width={18} height={18} strokeWidth={1.7} /></span>
                        로그아웃
                      </button>
                      {isAdmin && (
                        <Link href="/admin" className="nav-drawer-sub-link" onClick={closeDrawer}>
                          <span className="nav-drawer-icon"><ShieldCheck width={18} height={18} strokeWidth={1.7} /></span>
                          관리자
                        </Link>
                      )}
                    </nav>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        {shouldShowAvatarRegisterCta && avatarRegisterCta}

        {/* 하단 로그인/로그아웃 */}
        <div className="nav-drawer-footer">
          <div className="nav-drawer-footer-row">
            {mobileLeading ?? leading}
          </div>
        </div>
      </div>
      <UserProfileModal
        target={profileModalTarget}
        isSignedIn={!!isSignedIn}
        viewerRole={role}
        initialBio={profileModalBio}
        allowProfileEdit={true}
        onSaveBio={saveProfileBioFromHeader}
        onRequestSignIn={() => {
          closeDrawer();
          window.location.href = "/sign-in";
        }}
        onClose={() => {
          setProfileModalTarget(null);
          setProfileModalBio(null);
        }}
      />
    </>
  );
}
