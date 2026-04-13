import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { incrementUserReviewViewCount } from "@/lib/user-reviews";
import { UserContentPage } from "@/components/user-content-page";

export default async function MainUserContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ board?: string }>;
}) {
  const [{ userId }, { id }, { board }] = await Promise.all([auth(), params, searchParams]);
  if (!userId && board !== "qna") redirect("/sign-in");

  after(() => { void incrementUserReviewViewCount(id); });

  return <UserContentPage id={id} />;
}
