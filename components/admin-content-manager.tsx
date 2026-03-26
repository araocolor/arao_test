"use client";

import { useEffect, useRef, useState } from "react";
import { GALLERY_CATEGORIES, GALLERY_CATEGORY_LABELS, type GalleryCategory } from "@/lib/gallery-categories";
import type { LandingContent } from "@/lib/landing-content";

type AdminContentManagerProps = {
  initialContent: LandingContent;
};

async function loadImageAsDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AdminContentManager({ initialContent }: AdminContentManagerProps) {
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
      const dataUrl = await loadImageAsDataUrl(file);
      setContent((current) => {
        const existing = current.gallery[selectedGalleryCategory];
        return {
          ...current,
          gallery: {
            ...current.gallery,
            [selectedGalleryCategory]: {
              beforeImage: existing?.beforeImage ?? "",
              beforeImageFull: existing?.beforeImageFull ?? "",
              afterImage: existing?.afterImage ?? "",
              afterImageFull: existing?.afterImageFull ?? "",
              [key]: dataUrl,
            },
          },
        };
      });
      setPendingGalleryFiles((current) => ({ ...current, [key]: true }));
      setStatus("이미지를 불러왔습니다. 저장하기를 누르면 반영됩니다.");
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

    if (requiresGalleryFileCheck && !hasPendingGalleryFile) {
      setStatus("먼저 Before 또는 After 이미지를 첨부해주세요.");
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

      <section className="admin-form-card stack">
        <div className="admin-section-heading">
          <span className="muted">Gallery</span>
        </div>
        <div className="admin-form-grid">
          <div>
            <span className="muted" style={{ display: "block", marginBottom: "6px" }}>카테고리</span>
            <select
              className="admin-input"
              value={selectedGalleryCategory}
              onChange={(event) => {
                setSelectedGalleryCategory(event.target.value as GalleryCategory);
                setPendingGalleryFiles({ beforeImage: false, afterImage: false });
              }}
            >
              {GALLERY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{GALLERY_CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
          </div>
        </div>
        <textarea
          className="admin-textarea"
          rows={3}
          value={content.gallery[selectedGalleryCategory]?.body ?? ""}
          onChange={(event) =>
            setContent((current) => {
              const existing = current.gallery[selectedGalleryCategory];
              return {
                ...current,
                gallery: {
                  ...current.gallery,
                  [selectedGalleryCategory]: {
                    beforeImage: existing?.beforeImage ?? "",
                    beforeImageFull: existing?.beforeImageFull ?? "",
                    afterImage: existing?.afterImage ?? "",
                    afterImageFull: existing?.afterImageFull ?? "",
                    body: event.target.value,
                  },
                },
              };
            })
          }
          placeholder="섹션 문구"
        />
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
          <button
            className={
              (pendingGalleryFiles.beforeImage || pendingGalleryFiles.afterImage)
                ? "admin-save-button"
                : "admin-save-button admin-save-button-disabled"
            }
            type="button"
            onClick={() => void save("gallery")}
            disabled={savingKey !== null || (!pendingGalleryFiles.beforeImage && !pendingGalleryFiles.afterImage)}
          >
            {savingKey === "gallery" ? "저장 중..." : "저장"}
          </button>
        </div>
      </section>

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
    </div>
  );
}
