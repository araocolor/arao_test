"use client";

import { useEffect, useRef } from "react";
import type { LandingContent } from "@/lib/landing-content";

const QNA_CACHE_KEY = "user-review-list-cache-qna";
const CACHE_TTL = 5 * 60 * 1000;

function isQnaCacheFresh() {
  try {
    const raw = sessionStorage.getItem(QNA_CACHE_KEY);
    if (!raw) return false;
    const { ts } = JSON.parse(raw) as { ts: number };
    return Date.now() - ts < CACHE_TTL;
  } catch {
    return false;
  }
}

type LandingPageFooterProps = {
  content: LandingContent["footer"];
};

export function LandingPageFooter({ content }: LandingPageFooterProps) {
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        if (isQnaCacheFresh()) return;
        fetch("/api/main/user-review?page=1&limit=20&sort=latest&board=qna")
          .then((r) => (r.ok ? r.json() : null))
          .then((data: { items?: unknown[]; [key: string]: unknown } | null) => {
            if (!data || !Array.isArray(data.items)) return;
            sessionStorage.setItem(QNA_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
          })
          .catch(() => {});
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <footer className="landing-footer" id="help" ref={footerRef}>
      <div className="landing-footer-brand">
        <p className="landing-footer-company">{content.company}</p>
        <p className="landing-footer-text">{content.address}</p>
        <div className="landing-footer-socials">
          <a
            className="landing-footer-social"
            href="https://www.instagram.com/arao.color/"
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="4" width="16" height="16" rx="5" />
              <circle cx="12" cy="12" r="3.5" />
              <circle cx="17.2" cy="6.8" r="1.1" />
            </svg>
          </a>
          <a
            className="landing-footer-social"
            href="https://www.youtube.com/@Araocolor"
            target="_blank"
            rel="noreferrer"
            aria-label="YouTube"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="6.5" width="18" height="11" rx="4" />
              <path d="M10 9.5 15 12l-5 2.5z" />
            </svg>
          </a>
        </div>
      </div>
      <nav className="landing-footer-links">
        {content.links.map((link) => {
          const href =
            link.label === "개인정보처리방침" ? "/privacy.html" :
            link.label === "이용약관" ? "/terms.html" : link.href;
          return (
            <a key={link.label} className="landing-footer-link" href={href}>
              {link.label}
            </a>
          );
        })}
      </nav>
    </footer>
  );
}
