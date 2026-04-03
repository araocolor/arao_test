import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUserReviewList, createUserReview, type UserReviewSort } from "@/lib/user-reviews";
import { syncProfile } from "@/lib/profiles";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const pageParam = Number(url.searchParams.get("page") ?? "1");
    const limitParam = Number(url.searchParams.get("limit") ?? "20");
    const q = (url.searchParams.get("q") ?? "").trim();
    const sortParam = (url.searchParams.get("sort") ?? "latest").trim();
    const board = (url.searchParams.get("board") ?? "review").trim();

    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 100) : 20;
    const sort: UserReviewSort =
      sortParam === "views" || sortParam === "likes" ? sortParam : "latest";

    const { items, total } = await getUserReviewList({ page, limit, q, sort, board });
    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (error) {
    console.error("GET /api/main/user-review error:", error);
    return NextResponse.json(
      { items: [], total: 0, page: 1, limit: 20, totalPages: 1 },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;
  const profile = await syncProfile({ email, fullName });
  if (!profile) {
    return NextResponse.json({ message: "프로필을 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    const body = (await request.json()) as { category?: string; title?: string; content?: string; thumbnailImage?: string; thumbnailSmall?: string; attachedFile?: string; board?: string };
    const title = (body.title ?? "").trim();
    const content = (body.content ?? "").trim();
    const category = (body.category ?? "일반").trim();
    const board = (body.board ?? "review").trim();
    const thumbnailImage = body.thumbnailImage ?? undefined;
    const thumbnailSmall = body.thumbnailSmall ?? undefined;
    const attachedFile = body.attachedFile ?? undefined;

    if (!title) {
      return NextResponse.json({ message: "제목을 입력해주세요." }, { status: 400 });
    }

    const result = await createUserReview({ profileId: profile.id, category, title, content, thumbnailImage, thumbnailSmall: thumbnailSmall ?? undefined, attachedFile, board });
    if (!result) {
      return NextResponse.json({ message: "저장에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/main/user-review error:", error);
    return NextResponse.json({ message: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

