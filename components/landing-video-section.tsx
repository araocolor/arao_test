"use client";

import { useState } from "react";

type LandingVideoSectionProps = {
  label: string;
  title: string;
  body: string;
  youtubeUrl: string;
};

function extractYoutubeId(urlOrId: string) {
  if (!urlOrId) {
    return "";
  }

  if (!urlOrId.includes("http")) {
    return urlOrId;
  }

  try {
    const url = new URL(urlOrId);

    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace("/", "");
    }

    if (url.hostname.includes("youtube.com")) {
      return url.searchParams.get("v") ?? "";
    }
  } catch {
    return "";
  }

  return "";
}

export function LandingVideoSection({ label, title, body, youtubeUrl }: LandingVideoSectionProps) {
  const [playing, setPlaying] = useState(false);
  const videoId = extractYoutubeId(youtubeUrl);

  if (!videoId) {
    return null;
  }

  const thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  return (
    <section className="landing-stack-sm">
      <span className="landing-section-label">{label}</span>
      <h2 className="landing-video-title">{title}</h2>
      <p className="muted">{body}</p>
      <div className="landing-video-wrap">
        {playing ? (
          <iframe
            className="landing-video-iframe"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        ) : (
          <button className="landing-video-thumb" type="button" onClick={() => setPlaying(true)}>
            <img className="landing-video-img" src={thumbnail} alt={title} />
            <span className="landing-video-play">
              <svg viewBox="0 0 68 48" width="68" height="48">
                <path className="landing-video-play-bg" d="M66.5 7.7c-.8-2.9-2.9-5.1-5.7-5.9C55.9.1 34 0 34 0S12.1.1 7.2 1.8C4.4 2.6 2.3 4.8 1.5 7.7 0 12.7 0 24 0 24s0 11.3 1.5 16.3c.8 2.9 2.9 5.1 5.7 5.9C12.1 47.9 34 48 34 48s21.9-.1 26.8-1.8c2.8-.8 4.9-3 5.7-5.9C68 35.3 68 24 68 24s0-11.3-1.5-16.3z" />
                <path className="landing-video-play-arrow" d="M45 24 27 14v20z" />
              </svg>
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
