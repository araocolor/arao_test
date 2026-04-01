"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { BoardHeader } from "@/components/board-header";

type Category = "일반" | "공지";

const MAX_WIDTH = 1024;
const QUALITY = 0.7;
const MAX_BYTES = 1 * 1024 * 1024; // 1MB

function compressImage(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
        // base64 → bytes 추정
        const bytes = Math.round((dataUrl.length - "data:image/jpeg;base64,".length) * 0.75);
        if (bytes > MAX_BYTES) { resolve(null); return; }
        resolve(dataUrl);
      };
      img.onerror = () => resolve(null);
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export default function WriteReviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const isEditMode = !!editId;
  const { isSignedIn } = useUser();
  const [category, setCategory] = useState<Category>("일반");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 수정 모드: 기존 데이터 로드
  useEffect(() => {
    if (!editId) return;
    fetch(`/api/main/user-review/${editId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.title) setTitle(d.title);
        if (d.content) setContent(d.content);
        if (d.category && (d.category === "일반" || d.category === "공지")) setCategory(d.category);
        if (d.thumbnailImage) setImagePreview(d.thumbnailImage);
      })
      .catch(() => {});
  }, [editId]);

  function handleCancel() {
    router.back();
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!imageInputRef.current) return;
    imageInputRef.current.value = "";
    if (!file) return;

    setImageError(null);
    const result = await compressImage(file);
    if (!result) {
      setImageError("파일 1MB 이하로 업로드 가능합니다.");
      setImagePreview(null);
      return;
    }
    setImagePreview(result);
  }

  async function handleSave() {
    if (!title.trim() || saving) return;
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }
    setSaving(true);
    try {
      const url = isEditMode ? `/api/main/user-review/${editId}` : "/api/main/user-review";
      const method = isEditMode ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title: title.trim(),
          content: content.trim(),
          thumbnailImage: imagePreview ?? null,
        }),
      });
      if (res.ok) {
        if (isEditMode) {
          router.push(`/user_content/${editId}`);
        } else {
          router.push("/user_review");
        }
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="write-review-shell">
      {/* 상단 헤더 */}
      <BoardHeader
        menuItems={[{ label: "취소", onClick: handleCancel }]}
      />

      {/* 본문 */}
      <div className="write-review-body">
        {/* 카테고리 드롭다운 */}
        <div className="write-review-dropdown-wrap">
          <button
            type="button"
            className="user-review-dropdown-trigger"
            onClick={() => setDropdownOpen((v) => !v)}
          >
            {category}
            <svg
              className={`user-review-dropdown-arrow${dropdownOpen ? " open" : ""}`}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {dropdownOpen && (
            <div className="user-review-dropdown-menu">
              {(["일반", "공지"] as Category[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`user-review-dropdown-option${category === opt ? " active" : ""}`}
                  onClick={() => { setCategory(opt); setDropdownOpen(false); }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 구분선 */}
        <div className="write-review-divider" />

        {/* 제목 */}
        <input
          type="text"
          className="write-review-title-input"
          placeholder="제목을 입력해주세요"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
        />

        {/* 구분선 */}
        <div className="write-review-divider" />

        {/* 내용 */}
        <textarea
          className="write-review-content-input"
          placeholder="내용을 입력해주세요"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        {/* 이미지 프리뷰 */}
        {imagePreview && (
          <div className="write-review-image-preview">
            <img src={imagePreview} alt="첨부 이미지" />
            <button
              type="button"
              className="write-review-image-remove"
              onClick={() => setImagePreview(null)}
              aria-label="이미지 제거"
            >
              ✕
            </button>
          </div>
        )}

        {/* 이미지 오류 메시지 */}
        {imageError && (
          <p className="write-review-image-error">{imageError}</p>
        )}
      </div>

      {/* 하단 툴바 */}
      <footer className="write-review-toolbar">
        {/* 이미지 */}
        <button
          type="button"
          className="write-review-tool-btn"
          aria-label="이미지 첨부"
          onClick={() => imageInputRef.current?.click()}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </button>
        {/* 파일 */}
        <button
          type="button"
          className="write-review-tool-btn"
          aria-label="파일 첨부"
          onClick={() => fileInputRef.current?.click()}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        </button>
        {/* 저장 */}
        <button
          type="button"
          className={`write-review-save-btn${title.trim() && !saving ? " active" : ""}`}
          onClick={handleSave}
          disabled={!title.trim() || saving}
        >
          {saving ? "저장 중..." : "저장하기"}
        </button>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleImageChange}
        />
        <input ref={fileInputRef} type="file" style={{ display: "none" }} />
      </footer>
    </main>
  );
}
