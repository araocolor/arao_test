"use client";

type UserReviewItem = {
  id: string;
  title: string;
  content: string;
  thumbnailImage: string | null;
  thumbnailSmall: string | null;
  thumbnailFirst: string | null;
  attachedFile: string | null;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  authorId: string;
  isAuthor?: boolean;
};

function getFirstImage(thumbnailImage: string | null): string | null {
  if (!thumbnailImage) return null;
  try {
    const parsed = JSON.parse(thumbnailImage);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed[0] as string;
  } catch {
    // not JSON — use as-is
  }
  return thumbnailImage;
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "0000.00.00";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function excerpt(value: string, maxLength: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength)}...`;
}

export function UserReviewFeed({
  items,
  readIds,
  onOpenReview,
}: {
  items: UserReviewItem[];
  readIds: Set<string>;
  onOpenReview: (id: string) => void;
}) {
  return (
    <div className="user-review-feed">
      {items.map((item) => {
        const thumb = item.thumbnailFirst ?? getFirstImage(item.thumbnailImage);
        return (
          <button
            key={item.id}
            type="button"
            className={`user-review-item feed${item.isAuthor ? " mine" : ""}`}
            onClick={() => onOpenReview(item.id)}
          >
            <div className="user-review-feed-thumb">
              {thumb ? (
                <img src={thumb} alt="" loading="lazy" />
              ) : (
                <span className="user-review-item-thumb-empty" aria-hidden="true" />
              )}
            </div>
            <div className="user-review-feed-body">
              <p className="user-review-item-title">
                {!readIds.has(item.id) && <span className="user-review-unread-dot" aria-label="읽지 않음" />}
                {item.title}
                {(item.likeCount > 0 || item.attachedFile) && (
                  <span className="user-review-item-stats">
                    {item.attachedFile && (
                      <svg className="user-review-item-clip" aria-label="첨부파일" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    )}
                    {item.likeCount > 0 && (
                      <span className="user-review-item-stat">
                        <svg className="user-review-item-heart" aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 22V11m-4 1v8a2 2 0 0 0 2 2h12.4a2 2 0 0 0 2-1.6l1.2-8A2 2 0 0 0 18.6 9H14V4a2 2 0 0 0-2-2h-.1a2 2 0 0 0-1.9 1.4L7 11"/></svg>
                        {item.likeCount}
                      </span>
                    )}
                  </span>
                )}
              </p>
              <p className="user-review-feed-text">{excerpt(item.content, 80)}</p>
              <p className="user-review-item-meta">
                <span>{item.authorId}</span>
                <span>{formatDate(item.createdAt)}</span>
                <span>조회 {item.viewCount}</span>
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
