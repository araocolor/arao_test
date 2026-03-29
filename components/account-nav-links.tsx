"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";

export const userSections = [
  {
    id: "general",
    menu: "사용자",
    icon: "settings",
    eyebrow: "General",
    title: "사용자",
    description: "기본 계정 정보와 프로필 상태를 확인하고 이후 알림, 연락처, 비밀번호 변경 기능을 이 영역으로 확장할 수 있습니다.",
    items: ["이메일 확인", "이름 확인", "계정 기본 정보 관리"],
  },
  {
    id: "consulting",
    menu: "상담내역",
    icon: "consulting",
    eyebrow: "Support",
    title: "상담내역",
    description: "상담 요청과 답변 이력을 관리하는 자리입니다. 추후 문의 등록과 상태 변경 기능을 연결할 수 있습니다.",
    items: ["문의 접수 내역", "답변 상태 확인", "상담 기록 보관"],
  },
  {
    id: "orders",
    menu: "주문내역",
    icon: "orders",
    eyebrow: "Orders",
    title: "주문내역",
    description: "구매한 상품과 진행 중인 주문, 결제 상태를 한 곳에서 확인할 수 있도록 준비된 영역입니다.",
    items: ["최근 주문 목록", "주문 상태 추적", "결제 내역 확인"],
  },
  {
    id: "mycolor",
    menu: "내프로파일",
    icon: "mycolor",
    eyebrow: "My Profile",
    title: "내프로파일",
    description: "나의 컬러 프로파일 페이지입니다.",
    items: [],
  },
];

type NavLinksProps = {
  mobile?: boolean;
  footer?: boolean;
};

export function AccountNavLinks({ mobile, footer }: NavLinksProps) {
  const pathname = usePathname();

  const isActive = (sectionId: string) => {
    return pathname === `/account/${sectionId}`;
  };

  if (footer) {
    return (
      <nav className="account-footer-nav">
        <div className="account-footer-menu">
          <Link
            href="/"
            prefetch={true}
            className={`account-footer-item${pathname === "/" ? " active" : ""}`}
            title="홈"
          >
            <span className="account-menu-icon account-menu-icon-home" aria-hidden="true" />
            <span className="account-footer-label">홈</span>
          </Link>
          {userSections.map((section) => (
            <Link
              key={section.id}
              href={`/account/${section.id}`}
              prefetch={true}
              className={`account-footer-item${isActive(section.id) ? " active" : ""}`}
              title={section.menu}
            >
              <span className={`account-menu-icon account-menu-icon-${section.icon}`} aria-hidden="true" />
              <span className="account-footer-label">{section.menu}</span>
            </Link>
          ))}
        </div>
      </nav>
    );
  }

  if (mobile) {
    return (
      <div className="account-mobile-menu">
        {userSections.map((section) => (
          <Link
            key={section.id}
            href={`/account/${section.id}`}
            prefetch={true}
            className={`account-mobile-menu-item${isActive(section.id) ? " active" : ""}`}
          >
            <span className={`account-menu-icon account-menu-icon-${section.icon}`} aria-hidden="true" />
            <span>{section.menu}</span>
          </Link>
        ))}
        <SignOutButton>
          <button className="account-mobile-menu-item" type="button">
            <span className="account-menu-icon account-menu-icon-logout" aria-hidden="true" />
            <span>로그아웃</span>
          </button>
        </SignOutButton>
      </div>
    );
  }

  return (
    <div className="admin-menu-list">
      {userSections.map((section) => (
        <Link
          key={section.id}
          href={`/account/${section.id}`}
          prefetch={true}
          className={`admin-menu-item${isActive(section.id) ? " active" : ""}`}
        >
          <span className="account-menu-item-content">
            <span className={`account-menu-icon account-menu-icon-${section.icon}`} aria-hidden="true" />
            <span>{section.menu}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
