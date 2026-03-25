"use client";

import { useState } from "react";

type GalleryHeroItemProps = {
  beforeImage: string;
  afterImage: string;
  label?: string;
};

export function GalleryHeroItem({ beforeImage, afterImage, label }: GalleryHeroItemProps) {
  const [showBefore, setShowBefore] = useState(false);

  return (
    <div className="gallery-hero-image-wrap">
      <img
        className="gallery-hero-image"
        src={showBefore ? beforeImage : afterImage}
        alt={label ?? ""}
      />
      <button
        className={`gallery-before-btn${showBefore ? " active" : ""}`}
        type="button"
        onMouseDown={() => setShowBefore(true)}
        onMouseUp={() => setShowBefore(false)}
        onMouseLeave={() => setShowBefore(false)}
        onTouchStart={() => setShowBefore(true)}
        onTouchEnd={() => setShowBefore(false)}
      >
        Before
      </button>
    </div>
  );
}
