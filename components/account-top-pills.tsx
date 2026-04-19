"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PILL_ITEMS = [
  { href: "/account/general", label: "개인설정" },
  { href: "/account/consulting", label: "상담내역" },
  { href: "/account/orders", label: "주문관리" },
  { href: "/account/mycolor", label: "레시피" },
] as const;

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AccountTopPills() {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "nowrap" }}>
      {PILL_ITEMS.map((item) => {
        const isActive = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={true}
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              width: "fit-content",
              padding: "6px 14px",
              borderRadius: 999,
              background: isActive ? "#111111" : "#ffffff",
              border: isActive ? "1px solid #111111" : "1px solid #111111",
              color: isActive ? "#ffffff" : "#111111",
              lineHeight: 1.2,
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
