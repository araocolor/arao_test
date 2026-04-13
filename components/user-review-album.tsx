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
  isPinned?: boolean;
  isGlobalPinned?: boolean;
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

export function UserReviewAlbum({
  items,
  readIds,
  onOpenReview,
}: {
  items: UserReviewItem[];
  readIds: Set<string>;
  onOpenReview: (id: string) => void;
}) {
  return (
    <div className="user-review-album">
      {items.map((item) => {
        const thumb = item.thumbnailFirst ?? getFirstImage(item.thumbnailImage);
        const pinned = item.isPinned || item.isGlobalPinned;
        if (pinned) {
          return (
            <button
              key={item.id}
              type="button"
              className={`user-review-item album is-pinned${item.isGlobalPinned ? " is-global" : ""}${item.isAuthor ? " mine" : ""}`}
              onClick={() => onOpenReview(item.id)}
            >
              <p className="user-review-item-title user-review-item-title-pinned">
                <span className={`user-review-pin-badge${item.isGlobalPinned ? " is-global" : ""}`}>
                  {item.isGlobalPinned ? "필독" : "공지"}
                </span>
                {item.title}
              </p>
            </button>
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            className={`user-review-item album${item.isAuthor ? " mine" : ""}`}
            onClick={() => onOpenReview(item.id)}
          >
            <div className="user-review-album-thumb">
              {thumb ? (
                <img src={thumb} alt="" loading="lazy" />
              ) : (
                <span className="user-review-item-thumb-empty" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </span>
              )}
            </div>
            <p className="user-review-album-title">
              {!readIds.has(item.id) && <span className="user-review-unread-dot" aria-label="읽지 않음" />}
              {item.title}
              <span className="user-review-item-stats">
                {item.likeCount > 0 && (
                  <span className="user-review-item-stat">
                    <svg className="user-review-item-heart" aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 22V11m-4 1v8a2 2 0 0 0 2 2h12.4a2 2 0 0 0 2-1.6l1.2-8A2 2 0 0 0 18.6 9H14V4a2 2 0 0 0-2-2h-.1a2 2 0 0 0-1.9 1.4L7 11"/></svg>
                    {item.likeCount}
                  </span>
                )}
                {item.attachedFile && (
                  <svg className="user-review-item-clip" aria-label="첨부파일" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                )}
              </span>
            </p>
          </button>
        );
      })}
    </div>
  );
}
