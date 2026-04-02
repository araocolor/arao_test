"use client";

import { useEffect, useState } from "react";
import { UserContentHeader } from "@/components/user-content-header";
import { UserContentInteractions } from "@/components/user-content-interactions";

function LazyImage({ src, thumbnail }: { src: string; thumbnail?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {thumbnail && !loaded && (
        <img src={thumbnail} alt="" className="user-content-thumb user-content-thumb-blur" />
      )}
      <img
        src={src}
        alt=""
        className="user-content-thumb"
        style={{ display: loaded ? "block" : "none" }}
        onLoad={() => setLoaded(true)}
      />
    </>
  );
}

type ReviewItem = {
  id: string;
  title: string;
  content: string;
  thumbnailImage: string | null;
  thumbnailSmall: string | null;
  attachedFile: string | null;
  viewCount: number;
  createdAt: string;
  authorId: string;
  profileId: string;
  isAuthor: boolean;
};

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "0000.00.00";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function getContentCache(id: string): ReviewItem | null {
  try {
    const cached = sessionStorage.getItem(`user-review-content-${id}`);
    if (!cached) return null;
    const { data, ts } = JSON.parse(cached) as { data: ReviewItem; ts: number };
    if (Date.now() - ts < 300000 && data) return data;
  } catch {}
  return null;
}

export function UserContentPage({ id }: { id: string }) {
  // 첫 렌더링부터 캐시 데이터 동기적으로 읽음 (리스트와 동일 방식)
  const [item, setItem] = useState<ReviewItem | null>(() => getContentCache(id));
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    // 캐시 있으면 백그라운드 갱신, 없으면 fetch
    fetch(`/api/main/user-review/${id}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json() as Promise<ReviewItem>;
      })
      .then((data) => {
        if (data) {
          setItem(data);
          try {
            sessionStorage.setItem(`user-review-content-${id}`, JSON.stringify({ data, ts: Date.now() }));
          } catch {}
        }
      })
      .catch(() => { if (!item) setNotFound(true); });
  }, [id]);

  const contentImages: string[] = [];
  if (item?.thumbnailImage) {
    try {
      const parsed = JSON.parse(item.thumbnailImage);
      if (Array.isArray(parsed)) contentImages.push(...parsed);
      else contentImages.push(item.thumbnailImage);
    } catch {
      contentImages.push(item.thumbnailImage);
    }
  }

  // 2~3번째 이미지용 썸네일 (LQIP)
  const smallThumbs: string[] = [];
  if (item?.thumbnailSmall) {
    try {
      const parsed = JSON.parse(item.thumbnailSmall);
      if (Array.isArray(parsed)) smallThumbs.push(...parsed);
    } catch {}
  }

  let attachedFile: { name: string; type: string; data: string } | null = null;
  if (item?.attachedFile) {
    try {
      const parsed = JSON.parse(item.attachedFile);
      if (parsed && typeof parsed.name === "string" && typeof parsed.data === "string") {
        attachedFile = parsed;
      }
    } catch {}
  }

  return (
    <main className="landing-page">
      <UserContentHeader reviewId={id} isAuthor={item?.isAuthor ?? false} />
      <div className="landing-shell">
        {notFound ? (
          <section className="section stack">
            <h2>게시글을 찾을 수 없습니다</h2>
          </section>
        ) : !item ? (
          <div className="user-content-loading" />
        ) : (
          <>
            <article className="user-content-article">
              <h1 className="user-content-title">{item.title}</h1>
              <p className="user-content-meta muted">
                {item.authorId} · {formatDate(item.createdAt)} · 조회 {item.viewCount + 1}
              </p>
              {contentImages.map((src, i) => (
                i === 0 ? (
                  <img key={i} src={src} alt="" className="user-content-thumb" />
                ) : (
                  <LazyImage key={i} src={src} thumbnail={smallThumbs[i - 1]} />
                )
              ))}
              {attachedFile && (
                <a
                  href={attachedFile.data}
                  download={attachedFile.name}
                  className="user-content-file-download"
                >
                  <span className="user-content-file-zip-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </span>
                  <span className="user-content-file-name">{attachedFile.name}</span>
                  <span className="user-content-file-dl-label">다운로드</span>
                </a>
              )}
              <p className="user-content-body">{item.content}</p>
            </article>
            <UserContentInteractions reviewId={id} />
          </>
        )}
      </div>
    </main>
  );
}
