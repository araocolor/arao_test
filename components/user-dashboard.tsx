"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AdminSignOut } from "@/components/admin-sign-out";

const userSections = [
  {
    id: "general",
    menu: "일반설정",
    icon: "settings",
    eyebrow: "General",
    title: "일반설정",
    description: "기본 계정 정보와 프로필 상태를 확인하고 이후 알림, 연락처, 비밀번호 변경 기능을 이 영역으로 확장할 수 있습니다.",
    items: ["이메일 확인", "이름 확인", "계정 기본 정보 관리"],
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
    id: "consulting",
    menu: "상담내역",
    icon: "consulting",
    eyebrow: "Support",
    title: "상담내역",
    description: "상담 요청과 답변 이력을 관리하는 자리입니다. 추후 문의 등록과 상태 변경 기능을 연결할 수 있습니다.",
    items: ["문의 접수 내역", "답변 상태 확인", "상담 기록 보관"],
  },
  {
    id: "reviews",
    menu: "나의 후기",
    icon: "reviews",
    eyebrow: "Reviews",
    title: "나의 후기",
    description: "작성한 후기와 공개 상태를 확인하고 수정 흐름을 연결할 수 있도록 비워둔 영역입니다.",
    items: ["작성 후기 목록", "노출 여부 확인", "후기 수정 준비"],
  },
];

type UserDashboardProps = {
  email: string;
  fullName: string | null;
  username: string | null;
  hasPassword: boolean;
  phone: string | null;
};

export function UserDashboard({
  email,
  fullName,
  username: initialUsername,
  hasPassword: initialHasPassword,
  phone: initialPhone,
}: UserDashboardProps) {
  const [activeSectionId, setActiveSectionId] = useState(userSections[0].id);
  const [username, setUsername] = useState(initialUsername ?? "");
  const [hasPassword, setHasPassword] = useState(initialHasPassword);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [phoneInput, setPhoneInput] = useState("");
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [phoneMessage, setPhoneMessage] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const activeSection =
    userSections.find((section) => section.id === activeSectionId) ?? userSections[0];

  async function submitUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingKey("username");
    setUsernameMessage(null);

    const response = await fetch("/api/account/general", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "username", username: usernameInput }),
    });
    const data = (await response.json()) as { message?: string; username?: string };

    if (!response.ok) {
      setUsernameMessage(data.message ?? "아이디 등록 중 오류가 발생했습니다.");
      setSavingKey(null);
      return;
    }

    setUsername(data.username ?? usernameInput.trim().toLowerCase());
    setUsernameInput("");
    setUsernameMessage("아이디가 등록되었습니다.");
    setSavingKey(null);
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingKey("password");
    setPasswordMessage(null);

    const response = await fetch("/api/account/general", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "password", password: passwordInput }),
    });
    const data = (await response.json()) as { message?: string };

    if (!response.ok) {
      setPasswordMessage(data.message ?? "비밀번호 저장 중 오류가 발생했습니다.");
      setSavingKey(null);
      return;
    }

    setHasPassword(true);
    setPasswordInput("");
    setSavingKey(null);
  }

  async function submitPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingKey("phone");
    setPhoneMessage(null);

    const response = await fetch("/api/account/general", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "phone", phone: phoneInput }),
    });
    const data = (await response.json()) as { message?: string; phone?: string };

    if (!response.ok) {
      setPhoneMessage(data.message ?? "연락처 저장 중 오류가 발생했습니다.");
      setSavingKey(null);
      return;
    }

    setPhone(data.phone ?? phoneInput.replace(/\D/g, ""));
    setPhoneInput("");
    setIsEditingPhone(false);
    setSavingKey(null);
  }

  function formatMaskedPhone(value: string) {
    const digits = value.replace(/\D/g, "");

    if (digits.length !== 11) {
      return value;
    }

    return `+82 10-${digits.slice(3, 4)}***-${digits.slice(7, 8)}***`;
  }

  function renderGeneralSettings() {
    const hasUsernameInput = usernameInput.trim().length > 0;
    const hasPhoneInput = phoneInput.trim().length > 0;
    const hasPasswordInput = passwordInput.trim().length > 0;

    return (
      <div className="account-settings stack">
        <div className="account-settings-row">
          <div className="account-settings-copy">
            <h3>사용자 아이디</h3>
            {username ? (
              <div className="muted">로그인 서비스는 ID &amp; 이메일 모두 가능</div>
            ) : null}
          </div>
          {username ? (
            <div className="account-setting-static account-username-static">{username}</div>
          ) : (
            <form className="account-inline-form" onSubmit={submitUsername}>
              <div className="account-inline-row">
                <input
                  className="admin-input"
                  type="text"
                  value={usernameInput}
                  onChange={(event) => setUsernameInput(event.target.value)}
                  placeholder="아이디를 입력하세요"
                />
                <button
                  className={`admin-save-button account-state-button${hasUsernameInput ? " account-action-button-active" : ""}`}
                  type="submit"
                  disabled={savingKey === "username" || !hasUsernameInput}
                >
                  {savingKey === "username" ? "등록 중..." : "등록"}
                </button>
              </div>
            </form>
          )}
          {usernameMessage ? <div className="muted">{usernameMessage}</div> : null}
        </div>

        <div className="account-settings-row">
          <div className="account-settings-copy">
            <h3>연락처</h3>
          </div>
          {!phone || isEditingPhone ? (
            <form className="account-inline-form" onSubmit={submitPhone}>
              <div className="account-inline-row">
                <input
                  className="admin-input"
                  type="tel"
                  value={phoneInput}
                  onChange={(event) => setPhoneInput(event.target.value)}
                  placeholder="01012345678"
                />
                <button
                  className={`admin-save-button account-state-button${hasPhoneInput ? " account-action-button-active" : ""}`}
                  type="submit"
                  disabled={savingKey === "phone" || !hasPhoneInput}
                >
                  {savingKey === "phone" ? (phone ? "수정 중..." : "등록 중...") : phone ? "수정" : "등록"}
                </button>
              </div>
            </form>
          ) : (
            <div className="account-inline-row">
              <div className="account-setting-static account-phone-display">
                <span aria-hidden="true">📞</span>
                <span>{formatMaskedPhone(phone)}</span>
              </div>
              <button
                className="admin-save-button"
                type="button"
                onClick={() => {
                  setPhoneInput(phone);
                  setPhoneMessage(null);
                  setIsEditingPhone(true);
                }}
              >
                수정
              </button>
            </div>
          )}
          {phoneMessage ? <div className="muted">{phoneMessage}</div> : null}
        </div>

        <div className="account-settings-row">
          <div className="account-settings-copy">
            <h3>{hasPassword ? "비밀번호 수정" : "비밀번호"}</h3>
            {!hasPassword ? (
              <div className="muted">비밀번호를 설정하면 아이디 로그인 확장에 사용할 수 있습니다.</div>
            ) : null}
          </div>
          <form className="account-inline-form" onSubmit={submitPassword}>
            <div className="account-password-line">
              <div className="account-password-input-wrap">
                <input
                  className="admin-input account-password-input"
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(event) => setPasswordInput(event.target.value)}
                  placeholder={hasPassword ? "새 비밀번호를 입력하세요" : "비밀번호를 입력하세요"}
                />
                <button
                  className="account-vision-button account-vision-button-inline"
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M2.8 12s3.2-5 9.2-5 9.2 5 9.2 5-3.2 5-9.2 5-9.2-5-9.2-5z" />
                      <circle cx="12" cy="12" r="2.6" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 3l18 18" />
                      <path d="M2.8 12s3.2-5 9.2-5c1.9 0 3.5.5 4.8 1.2" />
                      <path d="M21.2 12s-3.2 5-9.2 5c-1.9 0-3.5-.5-4.8-1.2" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="account-password-actions">
                <button
                  className={`account-primary-button account-state-button${hasPasswordInput ? " account-action-button-active" : ""}`}
                  type="submit"
                  disabled={savingKey === "password" || !hasPasswordInput}
                >
                  {savingKey === "password"
                    ? hasPassword
                      ? "수정 중..."
                      : "등록 중..."
                    : hasPassword
                      ? "수정"
                      : "등록"}
                </button>
              </div>
            </div>
            <div className="account-helper-text">영문, 숫자 조합으로 6자 이상 입력</div>
          </form>
          {passwordMessage ? <div className="muted">{passwordMessage}</div> : null}
        </div>

        <div className="account-settings-row">
          <div className="account-settings-copy">
            <h3>이메일</h3>
            <div className="muted">회원가입 시 사용한 이메일 주소입니다.</div>
          </div>
          <div className="account-setting-static account-username-static">{email}</div>
        </div>

        <div className="account-settings-row">
          <Link className="account-delete-inline" href="/account/withdraw">
            회원탈퇴
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout admin-layout-root">
      <aside className="admin-sidebar admin-sidebar-root">
        <div className="admin-sidebar-top">
          <p className="admin-sidebar-title">사용자 관리</p>
        </div>

        <div className="admin-menu-list">
          {userSections.map((section) => (
            <button
              key={section.id}
              className={section.id === activeSectionId ? "admin-menu-item active" : "admin-menu-item"}
              type="button"
              onClick={() => setActiveSectionId(section.id)}
            >
              <span className="account-menu-item-content">
                <span className={`account-menu-icon account-menu-icon-${section.icon}`} aria-hidden="true" />
                <span>{section.menu}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="admin-sidebar-bottom">
          <AdminSignOut />
        </div>
      </aside>

      <div className="admin-panel stack">
        <div className="account-mobile-menu">
          {userSections.map((section) => (
            <button
              key={`mobile-${section.id}`}
              className={section.id === activeSectionId ? "account-mobile-menu-item active" : "account-mobile-menu-item"}
              type="button"
              onClick={() => setActiveSectionId(section.id)}
            >
              <span className={`account-menu-icon account-menu-icon-${section.icon}`} aria-hidden="true" />
              <span>{section.menu}</span>
            </button>
          ))}
        </div>
        <h1>사용자 계정 페이지</h1>
        <div className="admin-panel-card stack">
          <h2>{activeSection.title}</h2>
          {activeSection.id === "general" ? (
            renderGeneralSettings()
          ) : (
            <div className="admin-checklist">
              {activeSection.items.map((item) => (
                <div key={item} className="admin-check-item">
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
