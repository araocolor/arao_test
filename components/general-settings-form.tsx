"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type GeneralSettingsFormProps = {
  email: string;
  fullName: string | null;
  username: string | null;
  hasPassword: boolean;
  phone: string | null;
};

export function GeneralSettingsForm({
  email,
  fullName: initialFullName,
  username: initialUsername,
  hasPassword: initialHasPassword,
  phone: initialPhone,
}: GeneralSettingsFormProps) {
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
    setUsernameMessage("비밀번호를 설정하세요");
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

  const hasUsernameInput = usernameInput.trim().length > 0;
  const hasPhoneInput = phoneInput.trim().length > 0;
  const hasPasswordInput = passwordInput.trim().length > 0;

  return (
    <div className="account-settings stack">
      <div className="account-settings-row">
        <div className="account-settings-copy">
          <h3>이메일</h3>
          <div className="muted">회원가입 시 사용한 이메일 주소입니다.</div>
        </div>
        <div className="account-setting-static account-username-static">{email}</div>
      </div>

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
          <h3>{hasPassword ? "비밀번호 👌" : "비밀번호"}</h3>
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

      <div className="account-settings-row account-mobile-extra-section">
        <div className="account-settings-copy">
        </div>
      </div>

      <div className="account-settings-row">
        <Link className="account-delete-inline" href="/account/withdraw">
          회원탈퇴
        </Link>
      </div>
    </div>
  );
}
