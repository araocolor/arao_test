"use client";

import { useEffect, useState } from "react";
import { TierBadge } from "@/components/tier-badge";
import { Link as LinkIcon } from "lucide-react";

export type UserProfileModalTarget = {
  authorId: string;
  authorEmail?: string | null;
  authorTier?: string | null;
  iconImage?: string | null;
  bio?: string | null;
};

type UserProfileModalProps = {
  target: UserProfileModalTarget | null;
  isSignedIn: boolean;
  viewerRole: string | null | undefined;
  onRequestSignIn: () => void;
  onClose: () => void;
  allowProfileEdit?: boolean;
  initialBio?: string | null;
  onSaveBio?: (bio: string) => Promise<{ ok: boolean; message?: string; bio?: string }>;
};

const EMPTY_BIO_TEXT = "자기소개를 입력하세요";
const PROFILE_BIO_MAX_LENGTH = 200;
const PROFILE_LINK_PATTERN = /((?:https?:\/\/|www\.)?[^\s]*(?:youtube\.com|instagram\.com|naver\.com)[^\s]*)/gi;

function normalizeTier(tier: string | null | undefined): "member" | "pro" | "premium" {
  const normalized = (tier ?? "").trim().toLowerCase();
  if (normalized === "premium") return "premium";
  if (normalized === "pro") return "pro";
  return "member";
}

function getTierBadgeValue(tier: string | null | undefined): "pro" | "premium" | null {
  const normalized = (tier ?? "").trim().toLowerCase();
  if (normalized === "premium") return "premium";
  if (normalized === "pro") return "pro";
  return null;
}

function getDisplayEmail(target: UserProfileModalTarget): string {
  const fromTarget = (target.authorEmail ?? "").trim();
  if (fromTarget) return fromTarget;
  const author = (target.authorId ?? "").trim();
  return author.includes("@") ? author : "이메일주소";
}

function getInitialBioText() {
  return "";
}

function parseProfileLinkToken(rawToken: string) {
  const trimmed = rawToken.trim();
  if (!trimmed) return null;

  const trailingMatch = trimmed.match(/[),.!?]+$/);
  const trailingText = trailingMatch?.[0] ?? "";
  const token = trailingText ? trimmed.slice(0, -trailingText.length) : trimmed;
  if (!token) return null;

  const lowerToken = token.toLowerCase();
  if (
    !lowerToken.includes("youtube.com") &&
    !lowerToken.includes("instagram.com") &&
    !lowerToken.includes("naver.com")
  ) {
    return null;
  }

  const href = /^https?:\/\//i.test(token) ? token : `https://${token}`;
  const label = token.replace(/^https?:\/\//i, "");

  return { href, label, trailingText };
}

function renderProfileModalContent(
  target: UserProfileModalTarget,
  isEditingBio: boolean,
  savedBio: string,
  bioInput: string,
  onChangeBioInput: (next: string) => void,
) {
  const tierLabel = normalizeTier(target.authorTier);
  const tierForBadge = getTierBadgeValue(target.authorTier);
  return (
    <div className="user-content-profile-content">
      <div className="user-content-profile-avatar" data-tier={tierLabel}>
        {target.iconImage ? (
          <img src={target.iconImage} alt="" className="user-content-profile-avatar-img" />
        ) : (
          <span className="user-content-profile-avatar-default">
            {target.authorId.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <div className="user-content-profile-id-row">
        <strong className="user-content-profile-id">{target.authorId}</strong>
        <TierBadge tier={tierForBadge} size={18} marginLeft={0} />
      </div>
      <p className="user-content-profile-email">{getDisplayEmail(target)}</p>
      <p className="user-content-profile-bio-title">{tierLabel}</p>
      <div className="user-content-profile-divider" />
      {isEditingBio ? (
        <div className="user-content-profile-bio-edit-wrap">
          <textarea
            className="user-content-profile-bio-input"
            rows={5}
            maxLength={PROFILE_BIO_MAX_LENGTH}
            value={bioInput}
            onChange={(e) => onChangeBioInput(e.target.value)}
            placeholder="자기소개를 입력하세요"
            aria-label="자기소개 입력"
          />
          <p className="user-content-profile-bio-count">{`${bioInput.length}/${PROFILE_BIO_MAX_LENGTH}`}</p>
        </div>
      ) : (
        (() => {
          const lines = (savedBio || "").split("\n");
          const plainLines: string[] = [];
          const linkLines: Array<{ key: string; links: Array<{ href: string; label: string; key: string }> }> = [];

          lines.forEach((line, lineIndex) => {
            const segments = line.split(PROFILE_LINK_PATTERN);
            const textChunks: string[] = [];
            const lineLinks: Array<{ href: string; label: string; key: string }> = [];

            segments.forEach((segment, segmentIndex) => {
              const parsedLink = parseProfileLinkToken(segment);
              if (!parsedLink) {
                textChunks.push(segment);
                return;
              }
              lineLinks.push({
                href: parsedLink.href,
                label: `${parsedLink.label}${parsedLink.trailingText}`,
                key: `${lineIndex}-${segmentIndex}-${parsedLink.href}`,
              });
            });

            const plainText = textChunks.join("").trimEnd();
            if (plainText.length > 0) {
              plainLines.push(plainText);
            }
            if (lineLinks.length > 0) {
              linkLines.push({
                key: `line-link-${lineIndex}`,
                links: lineLinks,
              });
            }
          });

          return (
            <div className="user-content-profile-bio-sections">
              <div className="user-content-profile-bio-top">
                {plainLines.length > 0 ? (
                  plainLines.map((plainLine, idx) => (
                    <p key={`${idx}-${plainLine}`} className="user-content-profile-bio-line">{plainLine}</p>
                  ))
                ) : linkLines.length > 0 ? null : (
                  <p className="user-content-profile-bio-line user-content-profile-bio-empty">{EMPTY_BIO_TEXT}</p>
                )}
              </div>
              {linkLines.length > 0 ? (
                <div className="user-content-profile-bio-bottom">
                  <div className="user-content-profile-bio-link-row">
                    {linkLines.map((line) => (
                      <div key={line.key} className="user-content-profile-bio-link-line">
                        {line.links.map((link) => (
                          <a
                            key={link.key}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="user-content-profile-bio-link"
                          >
                            <span className="user-content-profile-bio-link-icon" aria-hidden="true">
                              <LinkIcon width={13} height={13} strokeWidth={2} />
                            </span>
                            {link.label}
                          </a>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })()
      )}
    </div>
  );
}

export function UserProfileModal({
  target,
  isSignedIn,
  onRequestSignIn,
  onClose,
  allowProfileEdit = false,
  initialBio = null,
  onSaveBio,
}: UserProfileModalProps) {
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [savedBio, setSavedBio] = useState(initialBio ?? target?.bio ?? getInitialBioText());
  const [bioInput, setBioInput] = useState(initialBio ?? target?.bio ?? getInitialBioText());
  const [savingBio, setSavingBio] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const initialBioValue = initialBio ?? target?.bio ?? getInitialBioText();
    setIsEditingBio(false);
    setSavedBio(initialBioValue);
    setBioInput(initialBioValue);
    setSavingBio(false);
    setSaveErrorMessage(null);
  }, [target, initialBio]);

  if (!target) return null;

  function handleStartProfileEdit() {
    if (!isSignedIn) {
      onRequestSignIn();
      return;
    }
    if (!allowProfileEdit) return;
    setIsEditingBio(true);
    setSaveErrorMessage(null);
  }

  function handleCancelProfileEdit() {
    setBioInput(savedBio);
    setIsEditingBio(false);
    setSaveErrorMessage(null);
  }

  async function handleSaveProfileEdit() {
    if (!allowProfileEdit) return;
    if (onSaveBio) {
      setSavingBio(true);
      setSaveErrorMessage(null);
      const result = await onSaveBio(bioInput);
      setSavingBio(false);
      if (!result.ok) {
        setSaveErrorMessage(result.message ?? "자기소개 저장에 실패했습니다.");
        return;
      }
      const nextBio = typeof result.bio === "string" ? result.bio : bioInput;
      setSavedBio(nextBio);
      setBioInput(nextBio);
      setIsEditingBio(false);
      return;
    }
    setSavedBio(bioInput);
    setIsEditingBio(false);
  }

  return (
    <>
      <div className="user-content-profile-modal-backdrop" onClick={onClose} />
      <div
        className={`user-content-profile-modal${isEditingBio ? " is-editing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="회원 정보 미리보기"
      >
        <div className="user-content-profile-modal-body">
          {renderProfileModalContent(target, isEditingBio, savedBio, bioInput, setBioInput)}
        </div>
        <div className="user-content-profile-modal-actions">
          {isEditingBio ? (
            <>
              <button
                type="button"
                className="user-content-profile-modal-btn is-muted"
                onClick={handleCancelProfileEdit}
                disabled={savingBio}
              >
                취소
              </button>
              <button
                type="button"
                className="user-content-profile-modal-btn"
                onClick={() => { void handleSaveProfileEdit(); }}
                autoFocus
                disabled={savingBio}
              >
                {savingBio ? "저장중..." : "저장"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="user-content-profile-modal-btn is-muted"
                onClick={handleStartProfileEdit}
                disabled={!allowProfileEdit}
                aria-disabled={!allowProfileEdit}
              >
                프로필편집
              </button>
              <button
                type="button"
                className="user-content-profile-modal-btn"
                onClick={onClose}
                autoFocus
              >
                닫기
              </button>
            </>
          )}
        </div>
        {saveErrorMessage ? <p className="user-content-profile-modal-error">{saveErrorMessage}</p> : null}
      </div>
    </>
  );
}
