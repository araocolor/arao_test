"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { BoardHeader } from "@/components/board-header";

// 이미지 슬롯 정의
const SLOTS = [
  { key: "standard", label: "Standard" },
  { key: "portrait", label: "Portrait" },
  { key: "arao", label: "Arao" },
] as const;

type SlotKey = (typeof SLOTS)[number]["key"];

// 이미지 압축
function compressToDataUrl(file: File, maxWidth: number, quality: number): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new window.Image();
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
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function uploadBatch(
  files: Array<{ blob: Blob; path: string; key: string }>
): Promise<Record<string, string>> {
  const form = new FormData();
  files.forEach((f, i) => {
    form.append(`file_${i}`, f.blob, "image.jpg");
    form.append(`path_${i}`, f.path);
    form.append(`key_${i}`, f.key);
  });
  try {
    const res = await fetch("/api/color/upload", { method: "POST", body: form });
    if (!res.ok) return {};
    const data = (await res.json()) as { urls: Record<string, string> };
    return data.urls;
  } catch { return {}; }
}

type SlotState = {
  file: File | null;
  preview: string | null;
};

const emptySlot = (): SlotState => ({ file: null, preview: null });

export default function ColorWritePage() {
  const router = useRouter();
  const { isSignedIn } = useUser();

  const [slots, setSlots] = useState<Record<SlotKey, SlotState>>({
    standard: emptySlot(),
    portrait: emptySlot(),
    arao: emptySlot(),
  });
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [price, setPrice] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingMsg, setSavingMsg] = useState("저장 중...");
  const [error, setError] = useState<string | null>(null);

  const inputRefs = useRef<Record<SlotKey, HTMLInputElement | null>>({
    standard: null,
    portrait: null,
    arao: null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const FILE_MAX = 5 * 1024 * 1024;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    if (file.size > FILE_MAX) { setFileError("파일은 5MB 이하만 첨부 가능합니다."); return; }
    setFileError(null);
    setAttachedFile(file);
  }

  async function handleImageSelect(slot: SlotKey, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRefs.current[slot]) inputRefs.current[slot]!.value = "";
    if (!file) return;
    const preview = await compressToDataUrl(file, 1024, 0.7);
    setSlots((prev) => ({ ...prev, [slot]: { file, preview } }));
  }

  function removeSlot(slot: SlotKey) {
    setSlots((prev) => ({ ...prev, [slot]: emptySlot() }));
  }

  async function handleSave() {
    if (!title.trim() || saving) return;
    if (!isSignedIn) { router.push("/sign-in"); return; }
    setError(null);
    setSaving(true);

    try {
      // 1단계: 글 생성 (이미지 없이)
      setSavingMsg("저장 중...");
      const res = await fetch("/api/color", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim() || null,
          price: price ? Number(price.replace(/,/g, "")) : null,
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(d?.message ?? "저장에 실패했습니다.");
      }
      const { id: postId } = (await res.json()) as { id: string };
      const idPrefix = postId.replace(/-/g, "").slice(0, 3);
      const version = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // 2단계: 이미지 업로드 (슬롯별 3버전)
      const slotKeys: SlotKey[] = ["standard", "portrait", "arao"];
      const batch: Array<{ blob: Blob; path: string; key: string }> = [];

      // 모든 슬롯 압축
      const compressed = await Promise.all(
        slotKeys.map(async (slot) => {
          const { file } = slots[slot];
          if (!file) return { slot, full: null, mid: null, thumb: null };
          const [full, mid, thumb] = await Promise.all([
            compressToDataUrl(file, 1024, 0.7),
            compressToDataUrl(file, 480, 0.8),
            compressToDataUrl(file, 200, 0.5),
          ]);
          return { slot, full, mid, thumb };
        })
      );

      setSavingMsg("이미지 업로드 중...");
      for (const { slot, full, mid, thumb } of compressed) {
        const base = `colors/${postId}/${idPrefix}_${version}_${slot}`;
        if (full) batch.push({ blob: dataUrlToBlob(full), path: `${base}_full.jpg`, key: `${slot}_full` });
        if (mid) batch.push({ blob: dataUrlToBlob(mid), path: `${base}_mid.jpg`, key: `${slot}_mid` });
        if (thumb) batch.push({ blob: dataUrlToBlob(thumb), path: `${base}_thumb.jpg`, key: `${slot}_thumb` });
      }

      // 첨부파일 업로드
      let fileLinkUrl: string | null = null;
      if (attachedFile) {
        setSavingMsg("파일 업로드 중...");
        const fileForm = new FormData();
        fileForm.append("file_0", attachedFile, attachedFile.name);
        fileForm.append("path_0", `colors/${postId}/attachments/${Date.now()}_${attachedFile.name}`);
        fileForm.append("key_0", "attached");
        const fileRes = await fetch("/api/color/upload", { method: "POST", body: fileForm });
        if (fileRes.ok) {
          const fileData = (await fileRes.json()) as { urls: Record<string, string> };
          fileLinkUrl = fileData.urls["attached"] ?? null;
        }
      }

      const urls = batch.length > 0 ? await uploadBatch(batch) : {};

      // 3단계: 이미지 + 파일 URL 업데이트
      if (Object.keys(urls).length > 0 || fileLinkUrl) {
        setSavingMsg("마무리 중...");
        const updateRes = await fetch(`/api/color/${postId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            img_standard_full: urls["standard_full"] ?? null,
            img_standard_mid: urls["standard_mid"] ?? null,
            img_standard_thumb: urls["standard_thumb"] ?? null,
            img_portrait_full: urls["portrait_full"] ?? null,
            img_portrait_mid: urls["portrait_mid"] ?? null,
            img_portrait_thumb: urls["portrait_thumb"] ?? null,
            img_arao_full: urls["arao_full"] ?? null,
            img_arao_mid: urls["arao_mid"] ?? null,
            img_arao_thumb: urls["arao_thumb"] ?? null,
            file_link: fileLinkUrl,
          }),
        });
        if (!updateRes.ok) throw new Error("이미지 저장에 실패했습니다.");
      }

      router.replace("/color");
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
      setSavingMsg("저장 중...");
    }
  }

  const canSave = title.trim().length > 0 && !saving;

  return (
    <main className="color-write-shell">
      <BoardHeader menuItems={[{ label: "취소", onClick: () => router.back() }]} />

      <div className="color-write-body">
        {/* 이미지 3슬롯 */}
        <div className="color-write-images">
          {SLOTS.map(({ key, label }) => (
            <div key={key} className="color-write-img-slot">
              <span className="color-write-img-label">{label}</span>
              <button
                type="button"
                className="color-write-img-btn"
                onClick={() => inputRefs.current[key]?.click()}
                aria-label={`${label} 이미지 선택`}
              >
                {slots[key].preview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={slots[key].preview!} alt={label} />
                    <button
                      type="button"
                      className="color-write-img-remove"
                      onClick={(e) => { e.stopPropagation(); removeSlot(key); }}
                      aria-label="이미지 제거"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <svg className="color-write-img-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                )}
              </button>
              <input
                ref={(el) => { inputRefs.current[key] = el; }}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => handleImageSelect(key, e)}
              />
            </div>
          ))}
        </div>

        {/* 제목 */}
        <div className="color-write-field">
          <label className="color-write-label">제목</label>
          <input
            type="text"
            className="color-write-input"
            placeholder="제목을 입력해주세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
          />
        </div>

        {/* 가격 */}
        <div className="color-write-field">
          <label className="color-write-label">가격</label>
          <input
            type="text"
            inputMode="numeric"
            className="color-write-input"
            placeholder="예: 50000"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
          />
        </div>

        {/* 파일 첨부 */}
        <div className="color-write-field">
          <label className="color-write-label">파일 첨부 (5MB 이하)</label>
          {attachedFile ? (
            <div className="write-review-file-badge">
              <span className="write-review-file-zip-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </span>
              <span className="write-review-file-name">{attachedFile.name}</span>
              <button
                type="button"
                className="write-review-file-remove"
                onClick={() => { setAttachedFile(null); setFileError(null); }}
                aria-label="파일 제거"
              >✕</button>
            </div>
          ) : (
            <button
              type="button"
              className="color-write-attach-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              파일 선택
            </button>
          )}
          {fileError && <p className="color-write-error">{fileError}</p>}
          <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleFileChange} />
        </div>

        {/* 내용 */}
        <div className="color-write-field">
          <label className="color-write-label">내용</label>
          <textarea
            className="color-write-textarea"
            placeholder="내용을 입력해주세요"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
          />
        </div>

        {error && <p className="color-write-error">{error}</p>}
      </div>

      <footer className="color-write-toolbar">
        <button
          type="button"
          className={`color-write-save-btn${canSave ? " active" : ""}`}
          onClick={handleSave}
          disabled={!canSave}
        >
          {saving ? savingMsg : "저장하기"}
        </button>
      </footer>
    </main>
  );
}
