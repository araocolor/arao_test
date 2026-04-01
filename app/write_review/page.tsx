"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { BoardHeader } from "@/components/board-header";

type Category = "일반" | "공지";

const MAX_WIDTH = 1024;
const QUALITY = 0.7;
const MAX_BYTES = 1 * 1024 * 1024; // 1MB
const MAX_IMAGES = 10;

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

function WriteReviewContent() {
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
  const [images, setImages] = useState<string[]>([]);
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
        if (d.thumbnailImage) {
          try {
            const parsed = JSON.parse(d.thumbnailImage);
            if (Array.isArray(parsed)) setImages(parsed);
            else setImages([d.thumbnailImage]);
          } catch {
            setImages([d.thumbnailImage]);
          }
        }
      })
      .catch(() => {});
  }, [editId]);

  function handleCancel() {
    router.back();
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (!files.length) return;

    setImageError(null);

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setImageError("사진은 최대 10장 가능합니다.");
      return;
    }

    const toProcess = files.slice(0, remaining);
    const skipped = files.length - toProcess.length;

    const results: string[] = [];
    let sizeError = false;

    for (const file of toProcess) {
      const result = await compressImage(file);
      if (!result) { sizeError = true; continue; }
      results.push(result);
    }

    if (results.length > 0) {
      setImages((prev) => {
        const next = [...prev, ...results];
        if (next.length > MAX_IMAGES) {
          setImageError("사진은 최대 10장 가능합니다.");
          return next.slice(0, MAX_IMAGES);
        }
        return next;
      });
    }

    if (skipped > 0) setImageError("사진은 최대 10장 가능합니다.");
    else if (sizeError) setImageError("파일 1MB 이하로 업로드 가능합니다.");
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImageError(null);
  }

  async function handleSave() {
    if (!title.trim() || saving) return;
    if (!isSignedIn) { router.push("/sign-in"); return; }
    setSaving(true);
    try {
      const url = isEditMode ? `/api/main/user-review/${editId}` : "/api/main/user-review";
      const method = isEditMode ? "PUT" : "POST";
      const thumbnailImage = images.length === 0
        ? null
        : images.length === 1
          ? images[0]
          : JSON.stringify(images);
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, title: title.trim(), content: content.trim(), thumbnailImage }),
      });
      if (res.ok) {
        router.push(isEditMode ? `/user_content/${editId}` : "/user_review");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="write-review-shell">
      <BoardHeader menuItems={[{ label: "취소", onClick: handleCancel }]} />

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
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {dropdownOpen && (
            <div className="user-review-dropdown-menu">
              {(["일반", "공지"] as Category[]).map((opt) => (
                <button
                  key={opt} type="button"
                  className={`user-review-dropdown-option${category === opt ? " active" : ""}`}
                  onClick={() => { setCategory(opt); setDropdownOpen(false); }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="write-review-divider" />

        <input
          type="text"
          className="write-review-title-input"
          placeholder="제목을 입력해주세요"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
        />

        <div className="write-review-divider" />

        <textarea
          className="write-review-content-input"
          placeholder="내용을 입력해주세요"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        {/* 이미지 프리뷰 그리드 */}
        {images.length > 0 && (
          <div className="write-review-image-grid">
            {images.map((src, i) => (
              <div key={i} className="write-review-image-thumb">
                <img src={src} alt={`첨부 이미지 ${i + 1}`} />
                <button
                  type="button"
                  className="write-review-image-remove"
                  onClick={() => removeImage(i)}
                  aria-label="이미지 제거"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 카운트 표시 */}
        {images.length > 0 && (
          <p className="write-review-image-count">{images.length} / {MAX_IMAGES}</p>
        )}

        {imageError && (
          <p className="write-review-image-error">{imageError}</p>
        )}
      </div>

      <footer className="write-review-toolbar">
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
          multiple
          style={{ display: "none" }}
          onChange={handleImageChange}
        />
        <input ref={fileInputRef} type="file" style={{ display: "none" }} />
      </footer>
    </main>
  );
}

export default function WriteReviewPage() {
  return (
    <Suspense>
      <WriteReviewContent />
    </Suspense>
  );
}
