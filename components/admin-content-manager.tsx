"use client";

import { useEffect, useRef, useState } from "react";
import { GALLERY_CATEGORIES, GALLERY_CATEGORY_LABELS, type GalleryCategory } from "@/lib/gallery-categories";
import type { GalleryExif, GalleryItem, LandingContent } from "@/lib/landing-content";

type AdminContentManagerProps = {
  initialContent: LandingContent;
  view?: "gallery" | "landing";
};


async function loadImageAsDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function compactString(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function createEmptyGalleryItem(): GalleryItem {
  return {
    beforeImage: "",
    beforeImageFull: "",
    afterImage: "",
    afterImageFull: "",
  };
}

function normalizeGalleryExif(exif?: GalleryExif | null) {
  if (!exif) {
    return undefined;
  }

  const normalized = Object.fromEntries(
    Object.entries(exif).filter(([, value]) => Boolean(value)),
  ) as GalleryExif;

  return Object.keys(normalized).length ? normalized : undefined;
}

function buildCameraLabel(makeRaw: string | null | undefined, modelRaw: string | null | undefined) {
  const make = compactString(makeRaw);
  const model = compactString(modelRaw);

  if (!make && !model) {
    return "";
  }

  if (!make) {
    return model;
  }

  if (!model) {
    return make;
  }

  const dedupedModel = model.replace(new RegExp(`^${make}`, "i"), "").trim();
  return compactString(`${make} ${dedupedModel || model}`);
}

function formatNumericValue(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "";
  }

  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatIsoValue(tags: Record<string, unknown>) {
  const iso = tags.ISO ?? tags.ISOSpeedRatings ?? tags.PhotographicSensitivity ?? tags.RecommendedExposureIndex;
  if (iso == null) {
    return "";
  }

  if (Array.isArray(iso)) {
    return String(iso[0] ?? "");
  }

  return String(iso);
}

function formatApertureValue(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }

  return `f/${formatNumericValue(numeric)}`;
}

function buildGalleryCaption(exif?: GalleryExif | null) {
  const normalized = normalizeGalleryExif(exif);
  if (!normalized) {
    return "";
  }

  const parts = [
    normalized.camera,
    normalized.lens,
    normalized.iso ? `ISO ${normalized.iso}` : "",
    normalized.aperture,
    normalized.exposureMode,
    normalized.whiteBalance,
  ].filter(Boolean);

  return parts.join(" / ");
}

async function readGalleryExif(file: File): Promise<GalleryExif | null> {
  try {
    const exifr = await import("exifr");
    const tags = (await exifr.parse(file, {
      mergeOutput: true,
      translateKeys: true,
      translateValues: true,
      pick: [
        "Make",
        "Model",
        "LensModel",
        "FocalLength",
        "FNumber",
        "ISO",
        "ISOSpeedRatings",
        "PhotographicSensitivity",
        "RecommendedExposureIndex",
        "ExposureMode",
        "ExposureProgram",
        "WhiteBalance",
      ],
    })) as Record<string, unknown> | null;

    if (!tags) {
      return null;
    }

    const lensModel = compactString(typeof tags.LensModel === "string" ? tags.LensModel : "");
    const focalLength = formatNumericValue(tags.FocalLength);
    const aperture = formatApertureValue(tags.FNumber);
    const exif = normalizeGalleryExif({
      camera: buildCameraLabel(
        typeof tags.Make === "string" ? tags.Make : "",
        typeof tags.Model === "string" ? tags.Model : "",
      ),
      lens: lensModel || [focalLength ? `${focalLength}mm` : "", aperture].filter(Boolean).join(" "),
      iso: formatIsoValue(tags),
      aperture,
      exposureMode: compactString(
        typeof tags.ExposureMode === "string"
          ? tags.ExposureMode
          : typeof tags.ExposureProgram === "string"
            ? tags.ExposureProgram
            : "",
      ),
      whiteBalance: compactString(
        typeof tags.WhiteBalance === "string" ? tags.WhiteBalance : "",
      ),
    });

    return exif ?? null;
  } catch {
    return null;
  }
}

export function AdminContentManager({ initialContent, view }: AdminContentManagerProps) {
  const [content, setContent] = useState(initialContent);
  const [status, setStatus] = useState<string>("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [pendingComparisonFiles, setPendingComparisonFiles] = useState({
    beforeImage: false,
    afterImage: false,
  });
  const [selectedGalleryCategory, setSelectedGalleryCategory] = useState<GalleryCategory>("people");
  const [pendingGalleryFiles, setPendingGalleryFiles] = useState({
    beforeImage: false,
    afterImage: false,
  });
  const [pendingGalleryText, setPendingGalleryText] = useState(false);
  const [galleryStatus, setGalleryStatus] = useState<string>("");
  const galleryStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUploadToast, setShowUploadToast] = useState(false);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPendingComparisonFile =
    pendingComparisonFiles.beforeImage || pendingComparisonFiles.afterImage;

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }

      if (progressHideTimerRef.current) {
        clearTimeout(progressHideTimerRef.current);
      }

      if (galleryStatusTimerRef.current) {
        clearTimeout(galleryStatusTimerRef.current);
      }
    };
  }, []);

  const updateReview = (index: number, key: "quote" | "name" | "detail", value: string) => {
    setContent((current) => ({
      ...current,
      reviews: {
        ...current.reviews,
        items: current.reviews.items.map((item, itemIndex) =>
          itemIndex === index ? { ...item, [key]: value } : item,
        ),
      },
    }));
  };

  const updateFooterLink = (index: number, key: "label" | "href", value: string) => {
    setContent((current) => ({
      ...current,
      footer: {
        ...current.footer,
        links: current.footer.links.map((link, linkIndex) =>
          linkIndex === index ? { ...link, [key]: value } : link,
        ),
      },
    }));
  };

  const updateSelectedGalleryItem = (updater: (current: GalleryItem) => GalleryItem) => {
    setContent((current) => {
      const existing = current.gallery[selectedGalleryCategory] ?? createEmptyGalleryItem();
      return {
        ...current,
        gallery: {
          ...current.gallery,
          [selectedGalleryCategory]: updater(existing),
        },
      };
    });
  };


  const onImageChange = async (key: "beforeImage" | "afterImage", file?: File) => {
    if (!file) {
      return;
    }

    try {
      const dataUrl = await loadImageAsDataUrl(file);
      setContent((current) => ({
        ...current,
        comparison: {
          ...current.comparison,
          [key]: dataUrl,
        },
      }));
      setPendingComparisonFiles((current) => ({
        ...current,
        [key]: true,
      }));
      setStatus("이미지를 불러왔습니다. 저장하기를 누르면 반영됩니다.");
    } catch {
      setStatus("이미지를 불러오지 못했습니다.");
    }
  };

  const onGalleryImageChange = async (key: "beforeImage" | "afterImage", file?: File) => {
    if (!file) return;
    try {
      const [dataUrl, extractedExif] = await Promise.all([
        loadImageAsDataUrl(file),
        readGalleryExif(file),
      ]);
      updateSelectedGalleryItem((existing) => {
        const previousAutoCaption = buildGalleryCaption(existing.exif);
        const nextExif = extractedExif ?? existing.exif;
        const nextAutoCaption = buildGalleryCaption(nextExif);
        const nextCaption = extractedExif && (!existing.caption || existing.caption === previousAutoCaption)
          ? nextAutoCaption
          : existing.caption ?? "";

        return {
          ...existing,
          [key]: dataUrl,
          caption: nextCaption,
          aspectRatio: existing.aspectRatio ?? "",
          exif: nextExif,
        };
      });
      if (extractedExif) setPendingGalleryText(true);
      setPendingGalleryFiles((current) => ({ ...current, [key]: true }));
      setStatus(extractedExif ? "이미지와 EXIF 정보를 불러왔습니다." : "이미지를 불러왔습니다. 저장하기를 누르면 반영됩니다.");
    } catch {
      setStatus("이미지를 불러오지 못했습니다.");
    }
  };

  const save = async (key: string) => {
    const requiresComparisonFileCheck = key === "comparison";
    const requiresGalleryFileCheck = key === "gallery";
    const hasPendingGalleryFile = pendingGalleryFiles.beforeImage || pendingGalleryFiles.afterImage;

    if (requiresComparisonFileCheck && !hasPendingComparisonFile) {
      setStatus("먼저 Before 또는 After 이미지를 첨부해주세요.");
      return;
    }

    if (requiresGalleryFileCheck && !hasPendingGalleryFile && !pendingGalleryText) {
      setStatus("제목, 문구 또는 이미지를 먼저 수정해주세요.");
      return;
    }

    setSavingKey(key);
    setStatus("");

    const isComparisonSave = key === "comparison" || key === "gallery" || key === "all";

    if (isComparisonSave) {
      setUploadProgress(12);

      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }

      progressTimerRef.current = setInterval(() => {
        setUploadProgress((current) => (current >= 90 ? current : current + 9));
      }, 180);
    }

    try {
      const response = await fetch("/api/admin/landing-content", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(content),
      });

      const data = (await response.json()) as LandingContent | { message?: string };

      if (!response.ok) {
        const message = "message" in data ? data.message : undefined;
        setStatus(message ?? "저장에 실패했습니다.");
        return;
      }

      setContent(data as LandingContent);
      setStatus("저장되었습니다. 홈 화면을 새로고침하면 바로 반영됩니다.");

      if (isComparisonSave) {
        setPendingComparisonFiles({ beforeImage: false, afterImage: false });
        setPendingGalleryFiles({ beforeImage: false, afterImage: false });
        setPendingGalleryText(false);

        if (key === "gallery") {
          setGalleryStatus("입력이 완료되었습니다.");
          if (galleryStatusTimerRef.current) clearTimeout(galleryStatusTimerRef.current);
          galleryStatusTimerRef.current = setTimeout(() => setGalleryStatus(""), 3000);
        }

        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }

        setUploadProgress(100);
        setShowUploadToast(true);

        if (progressHideTimerRef.current) {
          clearTimeout(progressHideTimerRef.current);
        }

        progressHideTimerRef.current = setTimeout(() => {
          setUploadProgress(0);
        }, 250);

        if (toastTimerRef.current) {
          clearTimeout(toastTimerRef.current);
        }

        toastTimerRef.current = setTimeout(() => {
          setShowUploadToast(false);
        }, 2200);
      }
    } catch {
      setStatus("저장 요청 중 문제가 발생했습니다.");
      if (isComparisonSave) {
        setUploadProgress(0);
        setShowUploadToast(false);
      }
    } finally {
      if (isComparisonSave && progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      setSavingKey(null);
    }
  };

  return (
    <div className="landing-manage stack">
      {showUploadToast ? <div className="admin-upload-toast">업로드가 완료되었습니다.</div> : null}
      {view !== "gallery" ? (
        <div className="admin-toolbar">
          <button
            className="sign-out-button"
            type="button"
            onClick={() => void save("all")}
            disabled={savingKey !== null}
          >
            {savingKey === "all" ? "저장 중..." : "저장하기"}
          </button>
          {status ? <p className="muted">{status}</p> : null}
        </div>
      ) : null}

      {view !== "gallery" ? (
        <>
        <section className="admin-form-card stack">
        <div className="admin-section-heading">
          <span className="muted">Hero</span>
          <button
            className="admin-save-button"
            type="button"
            onClick={() => void save("hero")}
            disabled={savingKey !== null}
          >
            {savingKey === "hero" ? "저장 중..." : "저장"}
          </button>
        </div>
        <input
          className="admin-input"
          value={content.hero.badge}
          onChange={(event) =>
            setContent((current) => ({
              ...current,
              hero: { ...current.hero, badge: event.target.value },
            }))
          }
          placeholder="작은 라벨"
        />
        <input
          className="admin-input"
          value={content.hero.title}
          onChange={(event) =>
            setContent((current) => ({
              ...current,
              hero: { ...current.hero, title: event.target.value },
            }))
          }
          placeholder="메인 제목"
        />
        <textarea
          className="admin-textarea"
          rows={4}
          value={content.hero.body}
          onChange={(event) =>
            setContent((current) => ({
              ...current,
              hero: { ...current.hero, body: event.target.value },
            }))
          }
          placeholder="본문"
        />
        <div className="admin-form-grid">
          <input
            className="admin-input"
            value={content.hero.ctaLabel}
            onChange={(event) =>
              setContent((current) => ({
                ...current,
                hero: { ...current.hero, ctaLabel: event.target.value },
              }))
            }
            placeholder="버튼 텍스트"
          />
          <input
            className="admin-input"
            value={content.hero.ctaHref}
            onChange={(event) =>
              setContent((current) => ({
                ...current,
                hero: { ...current.hero, ctaHref: event.target.value },
              }))
            }
            placeholder="버튼 링크"
          />
        </div>
      </section>

      <section className="admin-form-card stack">
        <div className="admin-section-heading">
          <span className="muted">Before / After</span>
        </div>
        <input
          className="admin-input"
          value={content.comparison.sectionTitle}
          onChange={(event) =>
            setContent((current) => ({
              ...current,
              comparison: { ...current.comparison, sectionTitle: event.target.value },
            }))
          }
          placeholder="섹션 제목"
        />
        <div className="admin-form-grid">
          <input
            className="admin-input"
            value={content.comparison.beforeLabel}
            onChange={(event) =>
              setContent((current) => ({
                ...current,
                comparison: { ...current.comparison, beforeLabel: event.target.value },
              }))
            }
            placeholder="Before 라벨"
          />
          <input
            className="admin-input"
            value={content.comparison.afterLabel}
            onChange={(event) =>
              setContent((current) => ({
                ...current,
                comparison: { ...current.comparison, afterLabel: event.target.value },
              }))
            }
            placeholder="After 라벨"
          />
        </div>
        <textarea
          className="admin-textarea"
          rows={3}
          value={content.comparison.beforeText}
          onChange={(event) =>
            setContent((current) => ({
              ...current,
              comparison: { ...current.comparison, beforeText: event.target.value },
            }))
          }
          placeholder="Before 설명"
        />
        <textarea
          className="admin-textarea"
          rows={3}
          value={content.comparison.afterText}
          onChange={(event) =>
            setContent((current) => ({
              ...current,
              comparison: { ...current.comparison, afterText: event.target.value },
            }))
          }
          placeholder="After 설명"
        />
        <div className="admin-form-grid">
          <label className="admin-upload stack">
            <span className="muted">Before 이미지</span>
            <img className="admin-image-preview" src={content.comparison.beforeImage} alt="Before preview" />
            <input type="file" accept="image/*" onChange={(event) => onImageChange("beforeImage", event.target.files?.[0])} />
          </label>
          <label className="admin-upload stack">
            <span className="muted">After 이미지</span>
            <img className="admin-image-preview" src={content.comparison.afterImage} alt="After preview" />
            <input type="file" accept="image/*" onChange={(event) => onImageChange("afterImage", event.target.files?.[0])} />
          </label>
        </div>
        <div className="admin-section-actions">
          <button
            className={hasPendingComparisonFile ? "admin-save-button" : "admin-save-button admin-save-button-disabled"}
            type="button"
            onClick={() => void save("comparison")}
            disabled={savingKey !== null || !hasPendingComparisonFile}
          >
            {savingKey === "comparison" ? "저장 중..." : "저장"}
          </button>
        </div>
        {savingKey === "comparison" || uploadProgress > 0 ? (
          <div className="admin-upload-progress" aria-live="polite">
            <div
              className="admin-upload-progress-bar"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        ) : null}
      </section>

      <section className="admin-form-card stack">
        <div className="admin-section-heading">
          <span className="muted">Reviews</span>
          <button
            className="admin-save-button"
            type="button"
            onClick={() => void save("reviews")}
            disabled={savingKey !== null}
          >
            {savingKey === "reviews" ? "저장 중..." : "저장"}
          </button>
        </div>
        <input
          className="admin-input"
          value={content.reviews.sectionTitle}
          onChange={(event) =>
            setContent((current) => ({
              ...current,
              reviews: { ...current.reviews, sectionTitle: event.target.value },
            }))
          }
          placeholder="리뷰 섹션 제목"
        />
        {content.reviews.items.map((item, index) => (
          <div key={`${item.name}-${index}`} className="admin-review-card stack">
            <span className="muted">리뷰 {index + 1}</span>
            <textarea
              className="admin-textarea"
              rows={3}
              value={item.quote}
              onChange={(event) => updateReview(index, "quote", event.target.value)}
              placeholder="리뷰 내용"
            />
            <div className="admin-form-grid">
              <input
                className="admin-input"
                value={item.name}
                onChange={(event) => updateReview(index, "name", event.target.value)}
                placeholder="이름"
              />
              <input
                className="admin-input"
                value={item.detail}
                onChange={(event) => updateReview(index, "detail", event.target.value)}
                placeholder="직함"
              />
            </div>
          </div>
        ))}
      </section>

      <section className="admin-form-card stack">
        <div className="admin-section-heading">
          <span className="muted">YouTube</span>
          <button
            className="admin-save-button"
            type="button"
            onClick={() => void save("video")}
            disabled={savingKey !== null}
          >
            {savingKey === "video" ? "저장 중..." : "저장"}
          </button>
        </div>
        <input
          className="admin-input"
          value={content.video.sectionTitle}
          onChange={(event) =>
            setContent((current) => ({
              ...current,
              video: { ...current.video, sectionTitle: event.target.value },
            }))
          }
          placeholder="섹션 제목"
        />
        <input
          className="admin-input"
          value={content.video.title}
          onChange={(event) =>
            setContent((current) => ({
              ...current,
              video: { ...current.video, title: event.target.value },
            }))
          }
          placeholder="영상 제목"
        />
        <textarea
          className="admin-textarea"
          rows={3}
          value={content.video.body}
          onChange={(event) =>
            setContent((current) => ({
              ...current,
              video: { ...current.video, body: event.target.value },
            }))
          }
          placeholder="관련 설명"
        />
        <input
          className="admin-input"
          value={content.video.youtubeUrl}
          onChange={(event) =>
            setContent((current) => ({
              ...current,
              video: { ...current.video, youtubeUrl: event.target.value },
            }))
          }
          placeholder="유튜브 주소 (예: https://www.youtube.com/watch?v=...)"
        />
      </section>
        </>
      ) : null}

      {view !== "landing" ? (
      <section className="admin-form-card stack">
        <div className="admin-section-heading">
          <span className="muted">Gallery</span>
        </div>
        <div className="admin-gallery-top-row">
          <div>
            <span className="muted" style={{ display: "block", marginBottom: "6px" }}>카테고리</span>
            <select
              className="admin-input"
              value={selectedGalleryCategory}
              onChange={(event) => {
                setSelectedGalleryCategory(event.target.value as GalleryCategory);
                setPendingGalleryFiles({ beforeImage: false, afterImage: false });
                setPendingGalleryText(false);
              }}
            >
              {GALLERY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{GALLERY_CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
          </div>
          <div>
            <span className="muted" style={{ display: "block", marginBottom: "6px" }}>이미지 비율</span>
            <select
              className="admin-input admin-input-compact"
              value={content.gallery[selectedGalleryCategory]?.aspectRatio ?? ""}
              onChange={(event) => {
                setPendingGalleryText(true);
                updateSelectedGalleryItem((existing) => ({
                  ...existing,
                  aspectRatio: event.target.value,
                }));
              }}
            >
              <option value="">선택</option>
              <option value="9/16">9:16</option>
              <option value="2/3">2:3</option>
              <option value="1/1">1:1</option>
              <option value="4/3">4:3</option>
              <option value="12/9">12:9</option>
            </select>
          </div>
        </div>
        <input
          className="admin-input"
          value={content.gallery[selectedGalleryCategory]?.title ?? ""}
          onChange={(event) => {
            setPendingGalleryText(true);
            updateSelectedGalleryItem((existing) => ({
              ...existing,
              title: event.target.value,
            }));
          }}
          placeholder="섹션 제목"
        />
        <textarea
          className="admin-textarea"
          rows={3}
          value={content.gallery[selectedGalleryCategory]?.body ?? ""}
          onChange={(event) => {
            setPendingGalleryText(true);
            updateSelectedGalleryItem((existing) => ({
              ...existing,
              body: event.target.value,
            }));
          }}
          placeholder="섹션 문구"
        />
        <input
          className="admin-input"
          value={content.gallery[selectedGalleryCategory]?.caption ?? ""}
          onChange={(event) => {
            setPendingGalleryText(true);
            updateSelectedGalleryItem((existing) => ({
              ...existing,
              caption: event.target.value,
            }));
          }}
          placeholder="촬영 정보 (예: Nikon ZF / 40mm f2 / ISO 400 / f/2)"
        />
        {content.gallery[selectedGalleryCategory]?.exif && (
          <div className="admin-exif-info">
            <div className="admin-exif-row">
              <span className="admin-exif-label">카메라</span>
              <span className="admin-exif-value">{content.gallery[selectedGalleryCategory]!.exif.camera || "—"}</span>
            </div>
            <div className="admin-exif-row">
              <span className="admin-exif-label">렌즈</span>
              <span className="admin-exif-value">{content.gallery[selectedGalleryCategory]!.exif.lens || "—"}</span>
            </div>
            <div className="admin-exif-row">
              <span className="admin-exif-label">ISO</span>
              <span className="admin-exif-value">{content.gallery[selectedGalleryCategory]!.exif.iso || "—"}</span>
            </div>
            <div className="admin-exif-row">
              <span className="admin-exif-label">조리개</span>
              <span className="admin-exif-value">{content.gallery[selectedGalleryCategory]!.exif.aperture || "—"}</span>
            </div>
            <div className="admin-exif-row">
              <span className="admin-exif-label">노출 모드</span>
              <span className="admin-exif-value">{content.gallery[selectedGalleryCategory]!.exif.exposureMode || "—"}</span>
            </div>
            <div className="admin-exif-row">
              <span className="admin-exif-label">화이트밸런스</span>
              <span className="admin-exif-value">{content.gallery[selectedGalleryCategory]!.exif.whiteBalance || "—"}</span>
            </div>
          </div>
        )}
        <div className="admin-form-grid">
          <label className="admin-upload stack">
            <span className="muted">Before 이미지</span>
            {content.gallery[selectedGalleryCategory]?.beforeImage ? (
              <img
                className="admin-image-preview"
                src={content.gallery[selectedGalleryCategory]!.beforeImage}
                alt="Before preview"
              />
            ) : (
              <div className="admin-image-preview admin-image-empty">미등록</div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(event) => void onGalleryImageChange("beforeImage", event.target.files?.[0])}
            />
          </label>
          <label className="admin-upload stack">
            <span className="muted">After 이미지</span>
            {content.gallery[selectedGalleryCategory]?.afterImage ? (
              <img
                className="admin-image-preview"
                src={content.gallery[selectedGalleryCategory]!.afterImage}
                alt="After preview"
              />
            ) : (
              <div className="admin-image-preview admin-image-empty">미등록</div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(event) => void onGalleryImageChange("afterImage", event.target.files?.[0])}
            />
          </label>
        </div>

        <div className="admin-section-actions">
          {galleryStatus ? <p className="admin-gallery-status">{galleryStatus}</p> : null}
          <button
            className={
              (pendingGalleryFiles.beforeImage || pendingGalleryFiles.afterImage || pendingGalleryText)
                ? "admin-save-button"
                : "admin-save-button admin-save-button-disabled"
            }
            type="button"
            onClick={() => void save("gallery")}
            disabled={savingKey !== null || (!pendingGalleryFiles.beforeImage && !pendingGalleryFiles.afterImage && !pendingGalleryText)}
          >
            {savingKey === "gallery" ? "저장 중..." : "저장"}
          </button>
        </div>
      </section>
      ) : null}

      {view !== "gallery" ? (
      <section className="admin-form-card stack">
        <div className="admin-section-heading">
          <span className="muted">Footer</span>
          <button
            className="admin-save-button"
            type="button"
            onClick={() => void save("footer")}
            disabled={savingKey !== null}
          >
            {savingKey === "footer" ? "저장 중..." : "저장"}
          </button>
        </div>
        <input
          className="admin-input"
          value={content.footer.company}
          onChange={(event) =>
            setContent((current) => ({
              ...current,
              footer: { ...current.footer, company: event.target.value },
            }))
          }
          placeholder="회사명"
        />
        <input
          className="admin-input"
          value={content.footer.address}
          onChange={(event) =>
            setContent((current) => ({
              ...current,
              footer: { ...current.footer, address: event.target.value },
            }))
          }
          placeholder="주소"
        />
        {content.footer.links.map((link, index) => (
          <div key={`${link.label}-${index}`} className="admin-form-grid">
            <input
              className="admin-input"
              value={link.label}
              onChange={(event) => updateFooterLink(index, "label", event.target.value)}
              placeholder="링크 텍스트"
            />
            <input
              className="admin-input"
              value={link.href}
              onChange={(event) => updateFooterLink(index, "href", event.target.value)}
              placeholder="링크 주소"
            />
          </div>
        ))}
      </section>
      ) : null}
    </div>
  );
}
