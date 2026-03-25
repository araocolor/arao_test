"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type SiteHeaderProps = {
  links: Array<{ href: string; label: string }>;
  action?: ReactNode;
  fullWidth?: boolean;
  leading?: ReactNode;
  mobileLeading?: ReactNode;
  mobileProfile?: ReactNode;
  mobileLogout?: ReactNode;
};

export function SiteHeader({
  links,
  action,
  fullWidth = false,
  leading,
  mobileLeading,
  mobileProfile,
  mobileLogout,
}: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuSheetRef = useRef<HTMLDivElement | null>(null);
  const menuToggleRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!menuMounted) {
      return;
    }

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const targetNode = event.target as Node | null;

      if (!targetNode) {
        return;
      }

      if (menuSheetRef.current?.contains(targetNode)) {
        return;
      }

      if (menuToggleRef.current?.contains(targetNode)) {
        return;
      }

      closeMenu();
    };

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
    };
  }, [menuMounted]);

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
    }, 180);
  };

  return (
    <header className={fullWidth ? "header header-full" : "header"}>
      <div className={fullWidth ? "header-inner" : "header-inner-inline"}>
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
          <button
            aria-expanded={menuOpen}
            aria-label="Open menu"
            className="header-menu-toggle"
            type="button"
            ref={menuToggleRef}
            onClick={() => (menuOpen ? closeMenu() : openMenu())}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {menuMounted ? (
        <div
          className={menuOpen ? "header-menu-popover is-open" : "header-menu-popover is-closing"}
          onClick={() => closeMenu()}
          role="presentation"
        >
          <div
            className={menuOpen ? "header-menu-sheet is-open" : "header-menu-sheet is-closing"}
            ref={menuSheetRef}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="header-menu-list">
              {links.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => closeMenu()}>
                  {link.label}
                </Link>
              ))}
            </div>
            {mobileLeading ?? leading ? (
              <div className="header-menu-extra">{mobileLeading ?? leading}</div>
            ) : null}
            {mobileLogout ? (
              <div className="header-menu-extra">{mobileLogout}</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
