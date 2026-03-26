"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import type { LandingContent } from "@/lib/landing-content";

type GalleryCaptionEditProps = {
  category: string;
  caption: string;
  content: LandingContent;
};

export function GalleryCaptionEdit({ category, caption, content }: GalleryCaptionEditProps) {
  const { isSignedIn } = useUser();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(caption);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const updatedContent: LandingContent = {
      ...content,
      gallery: {
        ...content.gallery,
        [category]: {
          ...content.gallery[category as keyof typeof content.gallery],
          caption: value,
        },
      },
    };

    await fetch("/api/admin/landing-content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedContent),
    });

    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="gallery-caption-edit-row">
        <input
          className="gallery-caption-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <button className="gallery-caption-btn" type="button" onClick={() => void handleSave()} disabled={saving}>
          {saving ? "저장 중" : "저장"}
        </button>
        <button className="gallery-caption-btn gallery-caption-btn-cancel" type="button" onClick={() => { setValue(caption); setEditing(false); }}>
          취소
        </button>
      </div>
    );
  }

  return (
    <p className="gallery-caption">
      {value}
      {isSignedIn ? (
        <button className="gallery-caption-edit-btn" type="button" onClick={() => setEditing(true)}>
          수정
        </button>
      ) : null}
    </p>
  );
}
