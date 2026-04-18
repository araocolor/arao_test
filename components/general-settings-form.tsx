"use client";

import { FormEvent, useState, useRef, useEffect } from "react";
import { UserRound } from "lucide-react";
import { clearCached } from "@/hooks/use-prefetch-cache";
import { useHeaderSessionStore } from "@/stores/header-session-store";

type GeneralSettingsFormProps = {
  email: string;
  fullName: string | null;
  username: string | null;
  hasPassword: boolean;
  phone: string | null;
  notificationEnabled: boolean;
  iconImage?: string;
  role: string;
  createdAt: string;
  usernameChangeCount?: number;
  usernameRegisteredAt?: string | null;
};

function getGeneralCacheKey(email?: string | null) {
  return email ? `general_${email.toLowerCase()}` : "general";
}

export function GeneralSettingsForm({
  email,
  fullName: initialFullName,
  username: initialUsername,
  hasPassword: initialHasPassword,
  phone: initialPhone,
  notificationEnabled: initialNotificationEnabled,
  iconImage: initialIconImage,
  role,
  createdAt,
  usernameChangeCount: initialUsernameChangeCount = 0,
  usernameRegisteredAt: initialUsernameRegisteredAt = null,
}: GeneralSettingsFormProps) {
  const [usernameChangeCount, setUsernameChangeCount] = useState(initialUsernameChangeCount);
  const [usernameRegisteredAt, setUsernameRegisteredAt] = useState<string | null>(initialUsernameRegisteredAt);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const setSessionUsername = useHeaderSessionStore((state) => state.setUsername);

  const isWithinEditWindow = (() => {
    if (!usernameRegisteredAt) return false;
    return Date.now() - new Date(usernameRegisteredAt).getTime() < 24 * 60 * 60 * 1000;
  })();
  const canEditUsername = isWithinEditWindow && usernameChangeCount < 5;
  const [username, setUsername] = useState(initialUsername ?? "");
  const [hasPassword, setHasPassword] = useState(initialHasPassword);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [notificationEnabled, setNotificationEnabled] = useState(initialNotificationEnabled);
  const [phoneInput, setPhoneInput] = useState("");
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [phoneMessage, setPhoneMessage] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [iconImage, setIconImage] = useState(initialIconImage ?? "");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarPopoverRef = useRef<HTMLDivElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const phoneEditFormRef = useRef<HTMLFormElement>(null);

  async function submitUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingKey("username");
    setUsernameMessage(null);

    const response = await fetch("/api/account/general", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "username", username: usernameInput }),
    });
    const data = (await response.json()) as { message?: string; username?: string; usernameChangeCount?: number };

    if (!response.ok) {
      setUsernameMessage(data.message ?? "아이디 등록 중 오류가 발생했습니다.");
      setSavingKey(null);
      return;
    }

    const wasFirstRegistration = !username;
    const newUsername = data.username ?? usernameInput.trim().toLowerCase();
    setUsername(newUsername);
    setSessionUsername(newUsername);
    setUsernameInput("");
    if (typeof data.usernameChangeCount === "number") {
      setUsernameChangeCount(data.usernameChangeCount);
    }
    if ((data as { usernameRegisteredAt?: string | null }).usernameRegisteredAt !== undefined) {
      setUsernameRegisteredAt((data as { usernameRegisteredAt?: string | null }).usernameRegisteredAt ?? null);
    }
    setIsEditingUsername(false);
    setUsernameMessage(wasFirstRegistration ? "비밀번호를 설정하세요" : "아이디가 변경되었습니다.");
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

  async function toggleNotification(enabled: boolean) {
    setSavingKey("notification");
    setNotificationMessage(null);

    // 즉시 UI 반영
    setNotificationEnabled(enabled);
    window.dispatchEvent(new CustomEvent("notification-setting-updated", { detail: { enabled } }));

    const response = await fetch("/api/account/general", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "notification", enabled }),
    });
    const data = (await response.json()) as { message?: string; notificationEnabled?: boolean };

    if (!response.ok) {
      // 실패 시 되돌리기
      setNotificationEnabled(!enabled);
      window.dispatchEvent(new CustomEvent("notification-setting-updated", { detail: { enabled: !enabled } }));
      setNotificationMessage(data.message ?? "알림 설정 저장 중 오류가 발생했습니다.");
      setSavingKey(null);
      return;
    }

    const nextEnabled = data.notificationEnabled ?? enabled;
    setNotificationEnabled(nextEnabled);
    setNotificationMessage(nextEnabled ? "알림 ON" : "알림 OFF");
    clearCached(getGeneralCacheKey(email));
    setSavingKey(null);
  }

  async function submitAvatar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingKey("avatar");
    setAvatarMessage(null);

    if (!previewImage) {
      setAvatarMessage("프로필 사진을 등록하세요");
      setSavingKey(null);
      return;
    }

    // canvas에서 압축된 base64 dataURL을 JSON으로 전송
    const response = await fetch("/api/account/avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl: previewImage }),
    });
    const data = (await response.json()) as { message?: string };

    if (!response.ok) {
      setAvatarMessage(data.message ?? "아이콘 저장 중 오류가 발생했습니다.");
      setSavingKey(null);
      return;
    }

    // 팝오버 닫고 아이콘을 미리보기 이미지로 즉시 반영
    if (previewImage) {
      setIconImage(previewImage);
      clearCached(getGeneralCacheKey(email));
      window.dispatchEvent(new CustomEvent("avatar-updated", { detail: { iconImage: previewImage } }));
    }

    setIsEditingAvatar(false);
    setPreviewImage(null);
    setSavingKey(null);
    setAvatarMessage("업로드 완료");
  }

  async function deleteAvatar() {
    setSavingKey("avatar-delete");
    setAvatarMessage(null);

    const response = await fetch("/api/account/avatar", {
      method: "DELETE",
    });
    const data = (await response.json()) as { message?: string };

    if (!response.ok) {
      setAvatarMessage(data.message ?? "아이콘 삭제 중 오류가 발생했습니다.");
      setSavingKey(null);
      return;
    }

    setIconImage("");
    setPreviewImage(null);
    setIsEditingAvatar(false);
    clearCached(getGeneralCacheKey(email));
    window.dispatchEvent(new CustomEvent("avatar-updated", { detail: { iconImage: null } }));
    setAvatarMessage("삭제 완료");
    setSavingKey(null);
  }

  function formatPhoneForInput(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length > 7) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
    if (digits.length > 3) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    return digits;
  }

  function beginPhoneEditing() {
    if (!phone || isEditingPhone) return;
    setPhoneInput(formatPhoneForInput(phone));
    setPhoneMessage(null);
    setIsEditingPhone(true);
  }

  function formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "날짜 오류";
      }
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${year}-${month}-${day}`;
    } catch {
      return "날짜 오류";
    }
  }

  useEffect(() => {
    if (!isEditingAvatar) return;

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        avatarPopoverRef.current?.contains(target) ||
        avatarButtonRef.current?.contains(target)
      ) return;
      setIsEditingAvatar(false);
      setPreviewImage(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isEditingAvatar]);

  useEffect(() => {
    if (!isEditingPhone) return;

    function handlePhoneOutsideClick(e: PointerEvent) {
      const target = e.target as Node;
      if (phoneEditFormRef.current?.contains(target)) return;
      setPhoneInput("");
      setPhoneMessage(null);
      setIsEditingPhone(false);
    }

    document.addEventListener("pointerdown", handlePhoneOutsideClick);
    return () => document.removeEventListener("pointerdown", handlePhoneOutsideClick);
  }, [isEditingPhone]);

  function handleAvatarFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 256;

        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // cover 방식: 이미지를 원 안에 꽉 채우도록 크롭
          const scale = Math.max(maxSize / img.width, maxSize / img.height);
          const scaledW = img.width * scale;
          const scaledH = img.height * scale;
          const offsetX = (maxSize - scaledW) / 2;
          const offsetY = (maxSize - scaledH) / 2;
          ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);
        }

        setPreviewImage(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  const hasUsernameInput = usernameInput.trim().length > 0;
  const hasPhoneInput = phoneInput.trim().length > 0;
  const hasPasswordInput = passwordInput.trim().length > 0;
  const avatarNotice = avatarMessage ?? "프로필 사진을 등록하세요";

  return (
    <div className="account-settings stack">
      <div className="account-settings-row">
        <div className="account-settings-copy">
          <h3>이메일</h3>
          <div className="muted">회원가입 시 사용한 이메일 주소입니다.</div>
        </div>
        <div className="account-email-row-right">
          <div className="account-setting-static account-username-static">{email}</div>
        </div>
      </div>

      <div className="account-settings-row">
        <div className="account-settings-copy">
          <h3>아이디</h3>
          <div className="muted">아이디 등록후 커뮤니티와 댓글 사용가능</div>
        </div>
        <div className="account-username-section">
          <div className="account-avatar-column">
            {iconImage ? (
              <img src={iconImage} alt={username || "avatar"} className="account-username-avatar" />
            ) : (
              <span className="account-username-avatar-placeholder" aria-hidden="true">
                <span className="account-username-register-fallback">
                  <UserRound
                    className="account-username-register-fallback-icon"
                    width={18}
                    height={18}
                    strokeWidth={1.8}
                  />
                </span>
              </span>
            )}
            <button
              ref={avatarButtonRef}
              className="account-avatar-edit-button"
              type="button"
              disabled={savingKey === "avatar-delete" || savingKey === "avatar"}
              onClick={() => {
                if (iconImage) {
                  void deleteAvatar();
                  return;
                }
                setIsEditingAvatar((v) => !v);
                setAvatarMessage(null);
              }}
            >
              {iconImage
                ? savingKey === "avatar-delete"
                  ? "삭제 중..."
                  : "삭제"
                : "업로드"}
            </button>

            {isEditingAvatar && (
              <div className="account-avatar-popover" ref={avatarPopoverRef}>
                <form onSubmit={submitAvatar}>
                  {previewImage && (
                    <div className="account-avatar-preview-container">
                      <img src={previewImage} alt="미리보기" className="account-avatar-preview" />
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    name="avatar-file"
                    accept="image/jpeg,image/png,image/gif"
                    className="account-avatar-input-hidden"
                    onChange={handleAvatarFileChange}
                  />
                  <div className="muted account-avatar-message">{avatarNotice}</div>
                  {!previewImage && (
                    <>
                      <button
                        type="button"
                        className="account-avatar-file-button"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        프로필사진
                      </button>
                      <div className="account-avatar-help">jpg, png, gif 파일을 업로드 하세요</div>
                    </>
                  )}
                  <div className={`account-avatar-actions${previewImage ? " is-compact" : ""}`}>
                    <button
                      type="submit"
                      className="account-avatar-upload-button"
                      disabled={savingKey === "avatar" || !previewImage}
                    >
                      {savingKey === "avatar"
                        ? (previewImage ? "확인 중..." : "업로드 중...")
                        : (previewImage ? "확인" : "업로드")}
                    </button>
                    <button
                      type="button"
                      className="account-avatar-cancel-button"
                      onClick={() => {
                        setIsEditingAvatar(false);
                        setPreviewImage(null);
                      }}
                    >
                      취소
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {username && !isEditingUsername ? (
            <div className="account-username-info">
              <div className="account-username-row">
                <div className="account-setting-static account-username-static">{username}</div>
                <div className="account-user-role">{role === "admin" ? "관리자" : "사용자"}</div>
                {canEditUsername && (
                  <button
                    type="button"
                    className="account-general-btn"
                    onClick={() => { setIsEditingUsername(true); setUsernameMessage(null); setUsernameInput(""); }}
                  >
                    수정
                  </button>
                )}
              </div>
              <div className="account-created-date">
                가입일: {formatDate(createdAt)}
                {canEditUsername ? ` · 아이디 수정 ${usernameChangeCount}/5회` : ""}
              </div>
            </div>
          ) : (
            <form className="account-inline-form" onSubmit={submitUsername}>
              <div className="account-inline-row">
                <input
                  className="account-general-input"
                  type="text"
                  value={usernameInput}
                  onChange={(event) => setUsernameInput(event.target.value)}
                  placeholder={username ? "새 아이디 (4~8자)" : "아이디등록 (4~8자 이내)"}
                  maxLength={8}
                />
                <button
                  className="account-general-btn"
                  type="submit"
                  disabled={savingKey === "username" || !hasUsernameInput}
                >
                  {savingKey === "username" ? (username ? "변경 중..." : "등록 중...") : username ? "변경" : "등록"}
                </button>
                {username && (
                  <button
                    type="button"
                    className="account-general-btn"
                    onClick={() => { setIsEditingUsername(false); setUsernameInput(""); setUsernameMessage(null); }}
                  >
                    취소
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
        {usernameMessage ? <div className="account-username-message">{usernameMessage}</div> : null}
      </div>

      <div className="account-settings-row">
        <div className="account-notification-row-main">
          <div className="account-settings-copy">
            <h3>알림 설정</h3>
            <div className="muted">서비스 알림 수신 여부를 설정합니다.</div>
          </div>
          <button
            type="button"
            className={`account-notification-toggle${notificationEnabled ? " is-on" : ""}`}
            onClick={() => void toggleNotification(!notificationEnabled)}
            disabled={savingKey === "notification"}
            aria-pressed={notificationEnabled}
            aria-label="알림 설정 토글"
          >
            <span className="account-notification-toggle-label">
              {notificationEnabled ? "알림 ON" : "알림 OFF"}
            </span>
            <span className="account-notification-toggle-track" aria-hidden="true">
              <span className="account-notification-toggle-thumb" />
            </span>
          </button>
        </div>
        {notificationMessage && <div className="account-helper-text">{notificationMessage}</div>}
      </div>

      <div className="account-settings-row">
        <div className="account-settings-copy">
          <h3>연락처</h3>
          <div className="muted">업데이트 소식 및 인증 보안 (선택)</div>
        </div>
        {!phone ? (
          <form ref={phoneEditFormRef} className="account-inline-form" onSubmit={submitPhone}>
            <div className="account-inline-row">
              <div className="account-phone-input-wrap">
                <span className="account-phone-prefix">+82</span>
                <input
                  className="account-general-input account-phone-input"
                  type="tel"
                  value={phoneInput}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, "").slice(0, 11);
                    let formatted = digits;
                    if (digits.length > 7) {
                      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
                    } else if (digits.length > 3) {
                      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
                    }
                    setPhoneInput(formatted);
                  }}
                  placeholder="010-1234-5678"
                  maxLength={13}
                />
              </div>
              <button
                className="account-general-btn"
                type="submit"
                disabled={savingKey === "phone" || !hasPhoneInput}
              >
                {savingKey === "phone" ? (phone ? "수정 중..." : "등록 중...") : phone ? "수정" : "등록"}
              </button>
            </div>
          </form>
        ) : (
          <form ref={phoneEditFormRef} className="account-inline-form" onSubmit={submitPhone}>
            <div className="account-inline-row">
              <div className="account-phone-input-wrap">
                <span className="account-phone-prefix">+82</span>
                <input
                  className="account-general-input account-phone-input"
                  type="tel"
                  value={isEditingPhone ? phoneInput : formatPhoneForInput(phone)}
                  onFocus={beginPhoneEditing}
                  onChange={(event) => {
                    if (!isEditingPhone) return;
                    const digits = event.target.value.replace(/\D/g, "").slice(0, 11);
                    let formatted = digits;
                    if (digits.length > 7) {
                      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
                    } else if (digits.length > 3) {
                      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
                    }
                    setPhoneInput(formatted);
                  }}
                  placeholder="010-1234-5678"
                  maxLength={13}
                  readOnly={!isEditingPhone}
                />
              </div>
              {isEditingPhone ? (
                <button
                  className="account-general-btn account-general-btn-active"
                  type="submit"
                  disabled={savingKey === "phone" || !hasPhoneInput}
                >
                  {savingKey === "phone" ? "수정 중..." : "수정"}
                </button>
              ) : (
                <button
                  className="account-general-btn"
                  type="button"
                  onClick={beginPhoneEditing}
                >
                  수정
                </button>
              )}
            </div>
          </form>
        )}
        {phoneMessage ? <div className="muted">{phoneMessage}</div> : null}
      </div>

      <div className="account-settings-row" hidden aria-hidden="true" style={{ display: "none" }}>
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
                className="account-general-input account-password-input"
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
                className="account-general-btn"
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

    </div>
  );
}
