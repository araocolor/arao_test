"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

type BoardHeaderProps = {
  menuItems?: { label: string; onClick: () => void }[];
  onBack?: () => void;
};

export function BoardHeader({ menuItems, onBack }: BoardHeaderProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [menuOpen]);

  return (
    <div className="header header-full">
      <div className="board-header-inner">
        {/* 뒤로가기 */}
        <button
          type="button"
          className="board-header-back"
          onClick={() => (onBack ? onBack() : router.back())}
          aria-label="뒤로가기"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* 로고 */}
        <Link href="/" className="board-header-logo">
          <Image src="/logo.svg" alt="ARAO" width={72} height={26} priority />
        </Link>

        {/* ... 메뉴 */}
        <div className="board-header-more-wrap" ref={menuRef}>
          <button
            type="button"
            className="board-header-more"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="더보기"
          >
            <span className="board-header-dot" />
            <span className="board-header-dot" />
            <span className="board-header-dot" />
          </button>

          {menuOpen && menuItems && menuItems.length > 0 && (
            <div className="board-header-menu">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="board-header-menu-item"
                  onClick={() => { item.onClick(); setMenuOpen(false); }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
