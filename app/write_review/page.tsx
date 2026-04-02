"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { BoardHeader } from "@/components/board-header";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Category = "일반" | "공지";

const MAX_IMAGES = 10;
const ORIGINAL_WIDTH = 1024;
const ORIGINAL_QUALITY = 0.7;
const MEDIUM_WIDTH = 480;
const MEDIUM_QUALITY = 0.8;
const THUMB_WIDTH = 200;
const THUMB_QUALITY = 0.5;
const MAX_BYTES = 1 * 1024 * 1024; // 1MB 미리보기 제한

function compressToDataUrl(file: File, maxWidth: number, quality: number): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(null);
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return new Blob([array], { type: mime });
}

async function uploadImage(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  blob: Blob,
  path: string
): Promise<string | null> {
  const { error } = await supabase.storage.from("board_image").upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) { console.error("upload error:", error); return null; }
  const { data } = supabase.storage.from("board_image").getPublicUrl(path);
  return data.publicUrl;
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
  const [savingMsg, setSavingMsg] = useState("저장 중...");
  // 미리보기용 원본 File 객체 보관
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  // 미리보기용 dataUrl (원본 압축)
  const [images, setImages] = useState<string[]>([]);
  // 수정 모드에서 기존 URL 이미지
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; type: string; data: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
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
            if (Array.isArray(parsed)) setExistingImageUrls(parsed);
            else setExistingImageUrls([d.thumbnailImage]);
          } catch {
            setExistingImageUrls([d.thumbnailImage]);
          }
        }
        if (d.attachedFile) {
          try {
            const parsed = JSON.parse(d.attachedFile);
            if (parsed && typeof parsed.name === "string") setAttachedFile(parsed);
          } catch {}
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

    const totalExisting = existingImageUrls.length + images.length;
    const remaining = MAX_IMAGES - totalExisting;
    if (remaining <= 0) { setImageError("사진은 최대 10장 가능합니다."); return; }

    const toProcess = files.slice(0, remaining);
    const skipped = files.length - toProcess.length;
    const results: { file: File; dataUrl: string }[] = [];
    let sizeError = false;

    for (const file of toProcess) {
      const dataUrl = await compressToDataUrl(file, ORIGINAL_WIDTH, ORIGINAL_QUALITY);
      if (!dataUrl) { sizeError = true; continue; }
      const bytes = Math.round((dataUrl.length - "data:image/jpeg;base64,".length) * 0.75);
      if (bytes > MAX_BYTES) { sizeError = true; continue; }
      results.push({ file, dataUrl });
    }

    if (results.length > 0) {
      setImageFiles((prev) => [...prev, ...results.map((r) => r.file)]);
      setImages((prev) => {
        const next = [...prev, ...results.map((r) => r.dataUrl)];
        if (next.length + existingImageUrls.length > MAX_IMAGES) {
          setImageError("사진은 최대 10장 가능합니다.");
          return next.slice(0, MAX_IMAGES - existingImageUrls.length);
        }
        return next;
      });
    }

    if (skipped > 0) setImageError("사진은 최대 10장 가능합니다.");
    else if (sizeError) setImageError("파일 1MB 이하로 업로드 가능합니다.");
  }

  function removeExistingImage(index: number) {
    setExistingImageUrls((prev) => prev.filter((_, i) => i !== index));
  }

  function removeNewImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImageError(null);
  }

  const FILE_MAX_BYTES = 5 * 1024 * 1024;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    setFileError(null);
    if (file.size > FILE_MAX_BYTES) { setFileError("파일은 5MB 이하만 첨부 가능합니다."); return; }
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.onerror = () => reject();
      reader.readAsDataURL(file);
    });
    setAttachedFile({ name: file.name, type: file.type, data });
  }

  async function handleSave() {
    if (!title.trim() || saving) return;
    if (!isSignedIn) { router.push("/sign-in"); return; }
    setSaving(true);

    try {
      const apiUrl = isEditMode ? `/api/main/user-review/${editId}` : "/api/main/user-review";
      const method = isEditMode ? "PUT" : "POST";

      // 1단계: 글 먼저 생성/수정 (이미지 URL 없이)
      setSavingMsg("저장 중...");
      const res = await fetch(apiUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title: title.trim(),
          content: content.trim(),
          attachedFile: attachedFile ? JSON.stringify(attachedFile) : null,
        }),
      });
      if (!res.ok) return;
      const resData = (await res.json()) as { id: string };
      const postId = resData.id;
      const idPrefix = postId.replace(/-/g, "").slice(0, 3);

      // 2단계: 새 이미지 Storage 업로드 (3가지 버전)
      if (imageFiles.length > 0) {
        setSavingMsg("이미지 업로드 중...");
        const supabase = createSupabaseBrowserClient();
        const originalUrls: string[] = [];
        const mediumUrls: string[] = [];
        const thumbUrls: string[] = [];

        await Promise.all(
          imageFiles.map(async (file, i) => {
            const idx = i + 1;
            const [origDataUrl, medDataUrl, thumbDataUrl] = await Promise.all([
              compressToDataUrl(file, ORIGINAL_WIDTH, ORIGINAL_QUALITY),
              compressToDataUrl(file, MEDIUM_WIDTH, MEDIUM_QUALITY),
              compressToDataUrl(file, THUMB_WIDTH, THUMB_QUALITY),
            ]);

            const [origUrl, medUrl, thumbUrl] = await Promise.all([
              origDataUrl ? uploadImage(supabase, dataUrlToBlob(origDataUrl), `${postId}/${idPrefix}_original_${idx}.jpg`) : null,
              medDataUrl ? uploadImage(supabase, dataUrlToBlob(medDataUrl), `${postId}/${idPrefix}_medium_${idx}.jpg`) : null,
              thumbDataUrl ? uploadImage(supabase, dataUrlToBlob(thumbDataUrl), `${postId}/${idPrefix}_thumb_${idx}.jpg`) : null,
            ]);

            originalUrls[i] = origUrl ?? "";
            mediumUrls[i] = medUrl ?? "";
            thumbUrls[i] = thumbUrl ?? "";
          })
        );

        // 기존 URL + 새 URL 합치기
        const allOriginals = [...existingImageUrls, ...originalUrls.filter(Boolean)];
        const allMediums = mediumUrls.filter(Boolean);
        const firstThumb = thumbUrls[0] ?? null;

        // 3단계: 이미지 URL로 DB 업데이트
        setSavingMsg("마무리 중...");
        await fetch(`/api/main/user-review/${postId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category,
            title: title.trim(),
            content: content.trim(),
            thumbnailImage: allOriginals.length === 1 ? allOriginals[0] : JSON.stringify(allOriginals),
            thumbnailSmall: allMediums.length > 0 ? JSON.stringify(allMediums) : null,
            thumbnailFirst: firstThumb,
            attachedFile: attachedFile ? JSON.stringify(attachedFile) : null,
          }),
        });
      } else if (isEditMode && existingImageUrls.length >= 0) {
        // 수정 모드에서 이미지 변경 없이 저장
        await fetch(`/api/main/user-review/${postId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category,
            title: title.trim(),
            content: content.trim(),
            thumbnailImage: existingImageUrls.length === 0 ? null : existingImageUrls.length === 1 ? existingImageUrls[0] : JSON.stringify(existingImageUrls),
            attachedFile: attachedFile ? JSON.stringify(attachedFile) : null,
          }),
        });
      }

      router.push(isEditMode ? `/user_content/${editId}` : "/user_review");
    } finally {
      setSaving(false);
      setSavingMsg("저장 중...");
    }
  }

  const totalImages = existingImageUrls.length + images.length;

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
        {totalImages > 0 && (
          <div className="write-review-image-grid">
            {existingImageUrls.map((src, i) => (
              <div key={`existing-${i}`} className="write-review-image-thumb">
                <img src={src} alt={`첨부 이미지 ${i + 1}`} />
                <button type="button" className="write-review-image-remove" onClick={() => removeExistingImage(i)} aria-label="이미지 제거">✕</button>
              </div>
            ))}
            {images.map((src, i) => (
              <div key={`new-${i}`} className="write-review-image-thumb">
                <img src={src} alt={`첨부 이미지 ${existingImageUrls.length + i + 1}`} />
                <button type="button" className="write-review-image-remove" onClick={() => removeNewImage(i)} aria-label="이미지 제거">✕</button>
              </div>
            ))}
          </div>
        )}

        {totalImages > 0 && (
          <p className="write-review-image-count">{totalImages} / {MAX_IMAGES}</p>
        )}

        {imageError && <p className="write-review-image-error">{imageError}</p>}

        {/* 첨부 파일 배지 */}
        {attachedFile && (
          <div className="write-review-file-badge">
            <span className="write-review-file-zip-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </span>
            <span className="write-review-file-name">{attachedFile.name}</span>
            <button type="button" className="write-review-file-remove" onClick={() => { setAttachedFile(null); setFileError(null); }} aria-label="파일 제거">✕</button>
          </div>
        )}
        {fileError && <p className="write-review-image-error">{fileError}</p>}
      </div>

      <footer className="write-review-toolbar">
        <button type="button" className="write-review-tool-btn" aria-label="이미지 첨부" onClick={() => imageInputRef.current?.click()}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </button>
        <button type="button" className="write-review-tool-btn" aria-label="파일 첨부" onClick={() => fileInputRef.current?.click()}>
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
          {saving ? savingMsg : "저장하기"}
        </button>

        <input ref={imageInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleImageChange} />
        <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleFileChange} />
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
