import Link from "next/link";
import type { LandingContent } from "@/lib/landing-content";

type LandingPageFooterProps = {
  content: LandingContent["footer"];
};

export function LandingPageFooter({ content }: LandingPageFooterProps) {
  return (
    <footer className="landing-footer" id="help">
      <div className="landing-footer-brand">
        <p className="landing-footer-company">{content.company}</p>
        <p className="landing-footer-text">{content.address}</p>
        <div className="landing-footer-socials">
          <a
            className="landing-footer-social"
            href="https://www.instagram.com"
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
            href="https://www.youtube.com"
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
        {content.links.map((link) => (
          <a key={link.label} className="landing-footer-link" href={link.href}>
            {link.label}
          </a>
        ))}
        <Link className="landing-footer-link" href="/admin">
          admin
        </Link>
      </nav>
    </footer>
  );
}
