import Link from "next/link";
import { getReviews } from "@/lib/reviews";
import { TierBadge } from "@/components/tier-badge";

export default async function AccountReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageStr } = await searchParams;
  const page = parseInt(pageStr || "1");
  const limit = 10;

  const { reviews, total } = await getReviews(page, limit);
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="account-panel-card stack page-slide-down">
      <p className="muted">Reviews</p>
      <h2>사용자 후기</h2>

      {/* 글쓰기 버튼 */}
      <div className="review-write-btn-container">
        <Link href="/account/reviews/write" className="btn-primary">
          글쓰기
        </Link>
      </div>

      {/* 리뷰 목록 테이블 */}
      {reviews.length === 0 ? (
        <div className="review-empty">작성된 후기가 없습니다.</div>
      ) : (
        <table className="review-table">
          <thead>
            <tr>
              <th style={{ width: "50px" }}>순번</th>
              <th style={{ width: "100px" }}>카테고리</th>
              <th>제목</th>
              <th style={{ width: "120px" }}>작성자</th>
              <th style={{ width: "100px" }}>날짜</th>
              <th style={{ width: "50px" }}>좋아요</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((review, idx) => (
              <tr key={review.id}>
                <td>{total - (page - 1) * limit - idx}</td>
                <td>{review.category}</td>
                <td>
                  <Link href={`/account/reviews/${review.id}`} className="link-text">
                    {review.title}
                  </Link>
                </td>
                <td>{review.author_username || review.author_fullname || "익명"}<TierBadge tier={review.author_tier} /></td>
                <td>{new Date(review.created_at).toLocaleDateString("ko-KR")}</td>
                <td>❤️ {review.like_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="review-pagination">
          {page > 1 && (
            <Link href={`/account/reviews?page=${page - 1}`} className="page-link">
              이전
            </Link>
          )}
          <span className="page-info">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/account/reviews?page=${page + 1}`} className="page-link">
              다음
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
