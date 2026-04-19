"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Sparkles, MousePointerClick, Tag, BookOpen, Settings2, Users, CreditCard, MessageCircle, HelpCircle, ShieldCheck } from "lucide-react";
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
  hideOnScrollMode?: "default" | "terms";
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

function createTempIdFromEmail(email: string | null): string {
  const localPart = (email?.split("@")[0] ?? "").trim();
  const prefix = `${localPart}xxx`.slice(0, 3);
  const specialChars = ["*", "+", "@", "!", "#", "$", "%", "&"];
  const letters = "abcdefghijklmnopqrstuvwxyz";

  let seedSource = email ?? "guest";
  if (!seedSource) seedSource = "guest";
  let seed = 0;
  for (let i = 0; i < seedSource.length; i += 1) {
    seed = (seed * 31 + seedSource.charCodeAt(i)) >>> 0;
  }

  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed;
  };

  const tail = [
    specialChars[nextRand() % specialChars.length],
    specialChars[nextRand() % specialChars.length],
    specialChars[nextRand() % specialChars.length],
    letters[nextRand() % letters.length],
    letters[nextRand() % letters.length],
  ];

  for (let i = tail.length - 1; i > 0; i -= 1) {
    const j = nextRand() % (i + 1);
    const tmp = tail[i];
    tail[i] = tail[j];
    tail[j] = tmp;
  }

  return `${prefix}${tail.join("")}`;
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [avatarToastVisible, setAvatarToastVisible] = useState(false);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [panelDragY, setPanelDragY] = useState(0);
  const [hideOnScroll, setHideOnScroll] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const lastScrollYRef = useRef(0);
  const lastScrollTsRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);
  const username = useHeaderSessionStore((state) => state.username);
  const usernameReady = useHeaderSessionStore((state) => state.usernameReady);
  const avatar = useHeaderSessionStore((state) => state.avatar);
  const email = useHeaderSessionStore((state) => state.email);
  const role = useHeaderSessionStore((state) => state.role);
  const setSessionUsername = useHeaderSessionStore((state) => state.setUsername);
  const hasUsername = !!(username && username.trim().length > 0);
  const [idInputFocused, setIdInputFocused] = useState(false);
  const [idInputValue, setIdInputValue] = useState("");
  const [idErrorMsg, setIdErrorMsg] = useState("");
  const [idConfirmErrorMsg, setIdConfirmErrorMsg] = useState("");
  const [idChecking, setIdChecking] = useState(false);
  const [idSubmitting, setIdSubmitting] = useState(false);
  const [idConfirmOpen, setIdConfirmOpen] = useState(false);
  const [pendingUsername, setPendingUsername] = useState("");

  function getUsernameSaveError(message?: string) {
    if (!message) return "아이디 저장 실패";
    if (message.includes("이미 사용 중")) return "해당 아이디는 등록할 수 없어요.";
    return message;
  }

  function getUsernameCheckError(message?: string) {
    if (!message) return "중복 확인 실패";
    if (message.includes("등록할 수 없어요")) return message;
    if (message.includes("이미 사용 중")) return "해당 아이디는 등록할 수 없어요.";
    return message;
  }

  async function submitUsername(value: string) {
    const nextValue = value.trim();
    if (!/^[A-Za-z0-9]{4,8}$/.test(nextValue)) {
      setIdErrorMsg("4-8자 영어, 숫자 조합");
      return;
    }
    setIdSubmitting(true);
    try {
      const res = await fetch("/api/account/general", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "username", username: nextValue }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIdConfirmErrorMsg(getUsernameSaveError(data?.message));
        return;
      }
      setIdErrorMsg("");
      setIdConfirmErrorMsg("");
      setSessionUsername(data?.username ?? nextValue);
      setIdInputValue("");
      setIdConfirmOpen(false);
      setPendingUsername("");
    } catch {
      setIdErrorMsg("네트워크 오류");
    } finally {
      setIdSubmitting(false);
    }
  }

  async function openIdConfirm() {
    const value = idInputValue.trim();
    if (!/^[A-Za-z0-9]{4,8}$/.test(value)) {
      setIdErrorMsg("4-8자 영어, 숫자 조합");
      return;
    }
    setIdErrorMsg("");
    setIdConfirmErrorMsg("");
    setIdChecking(true);
    try {
      const res = await fetch("/api/account/general", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "username-check", username: value }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setIdErrorMsg(getUsernameCheckError(data?.message));
        return;
      }
      setPendingUsername(value);
      setIdConfirmOpen(true);
    } catch {
      setIdErrorMsg("네트워크 오류");
    } finally {
      setIdChecking(false);
    }
  }

  function closeIdConfirm() {
    setIdConfirmOpen(false);
    setPendingUsername("");
    setIdConfirmErrorMsg("");
  }
  const usernameLabel = useMemo(() => {
    if (hasUsername) return username as string;
    return createTempIdFromEmail(email);
  }, [hasUsername, username, email]);

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

  // 아바타 미등록 안내 토스트: 드로어 열림 1초 후 표시, 2초 후 숨김
  useEffect(() => {
    if (!drawerOpen || !isSignedIn || avatar) {
      setAvatarToastVisible(false);
      return;
    }
    const showTimer = setTimeout(() => {
      setAvatarToastVisible(true);
      const hideTimer = setTimeout(() => setAvatarToastVisible(false), 5000);
      (showTimer as unknown as { hideTimer?: ReturnType<typeof setTimeout> }).hideTimer = hideTimer;
    }, 1000);
    return () => {
      clearTimeout(showTimer);
      const hideTimer = (showTimer as unknown as { hideTimer?: ReturnType<typeof setTimeout> }).hideTimer;
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [drawerOpen, isSignedIn, avatar]);

  // 헤더 숨김 로직: 기본(default) / terms 스타일(빠른 상향 스크롤에서만 표시)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(min-width: 820px)");
    const defaultMinDelta = 6;
    const defaultMinScrollTop = 72;
    const termsShowTopY = 12;
    const termsHideDownDelta = 4;
    const termsFastUpwardSpeed = 3.5; // px/ms

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

  const closeDrawer = () => { setDrawerOpen(false); setProfilePanelOpen(false); };
  const handleAvatarClick = () => {
    if (isSignedIn) {
      setProfilePanelOpen((v) => !v);
    } else {
      window.location.href = "/sign-in";
    }
  };
  const shouldHideHeader = fullWidth && hideOnScroll;
  const hideClassName = hideOnScrollMode === "terms" ? "header-scroll-hidden-terms" : "header-scroll-hidden";

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
          {role === "admin" && (
            <div style={{ padding: "5px 24px 0" }}>
              <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, color: "#fff", background: "red", borderRadius: 20, padding: "1px 6px", lineHeight: "18px" }}>admin</span>
            </div>
          )}
          <div className="nav-drawer-profile-panel-email" style={role === "admin" ? { paddingTop: 4 } : undefined}>
            {email ?? ""}
          </div>
          <nav className="nav-drawer-list">
            <Link href="/account/orders" className="nav-drawer-link" onClick={closeDrawer}>
              <span className="nav-drawer-icon"><CreditCard width={20} height={20} strokeWidth={1.7} /></span>
              결제내역
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
            <Link href="/account/general" className="nav-drawer-link" onClick={closeDrawer}>
              <span className="nav-drawer-icon"><Settings2 width={20} height={20} strokeWidth={1.7} /></span>
              사용자설정
            </Link>
          </nav>
        </div>

        {isSignedIn && !avatar && (
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
        )}
        <div className="nav-drawer-footer-top" style={idErrorMsg ? { color: "#e53935" } : undefined}>{idErrorMsg ? idErrorMsg : idInputFocused ? "4-8자 영어, 숫자 조합" : ""}</div>

        {/* 하단 로그인/로그아웃 */}
        <div className="nav-drawer-footer" onClick={!isSignedIn ? () => { window.location.href = "/sign-in"; } : undefined} style={!isSignedIn ? { cursor: "pointer" } : undefined}>
          <div className="nav-drawer-footer-row">
            {isSignedIn && usernameReady && (
              hasUsername ? (
                <button
                  type="button"
                  className="nav-drawer-profile-trigger"
                  onClick={handleAvatarClick}
                  aria-label="사용자 메뉴"
                >
                  <span className="nav-drawer-avatar-icon">{mobileProfile}</span>
                  <span className="nav-drawer-avatar-meta">
                    <span className="nav-drawer-avatar-label">{usernameLabel}</span>
                  </span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="nav-drawer-avatar-btn"
                    onClick={handleAvatarClick}
                    aria-label="사용자 메뉴"
                  >
                    {mobileProfile}
                  </button>
                  <div className="nav-drawer-avatar-meta">
                    <div className="nav-drawer-id-input-wrap">
                      <input
                        type="text"
                        className="nav-drawer-id-input"
                        placeholder="아이디 등록"
                        value={idInputValue}
                        onChange={(e) => { setIdInputValue(e.target.value); setIdErrorMsg(""); }}
                        onFocus={() => { setIdInputFocused(true); if (profilePanelOpen) setProfilePanelOpen(false); }}
                        onBlur={() => setIdInputFocused(false)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void openIdConfirm();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="nav-drawer-id-edit-btn"
                        disabled={idChecking || idSubmitting}
                        onClick={() => { void openIdConfirm(); }}
                      >
                        {idChecking ? "확인 중..." : "확인"}
                      </button>
                    </div>
                  </div>
                </>
              )
            )}
            {mobileFooterLogout}
            {mobileLeading ?? leading}
          </div>
        </div>

        {idConfirmOpen && (
          <div
            className="nav-drawer-id-modal-backdrop"
            onClick={closeIdConfirm}
            aria-hidden="true"
          >
            <div
              className="nav-drawer-id-modal"
              role="dialog"
              aria-modal="true"
              aria-label="아이디 확인"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="nav-drawer-id-modal-text">
                입력한 아이디가 <strong>{pendingUsername}</strong> 맞나요?
              </p>
              {idConfirmErrorMsg && (
                <p className="nav-drawer-id-modal-error">{idConfirmErrorMsg}</p>
              )}
              <div className="nav-drawer-id-modal-actions">
                <button type="button" className="nav-drawer-id-modal-btn nav-drawer-id-modal-btn-cancel" onClick={closeIdConfirm}>
                  취소
                </button>
                <button
                  type="button"
                  className="nav-drawer-id-modal-btn nav-drawer-id-modal-btn-confirm"
                  disabled={idSubmitting}
                  onClick={() => void submitUsername(pendingUsername)}
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
