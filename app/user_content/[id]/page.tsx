import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { incrementUserReviewViewCount } from "@/lib/user-reviews";
import { UserContentPage } from "@/components/user-content-page";

export default async function MainUserContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ userId }, { id }] = await Promise.all([auth(), params]);
  if (!userId) redirect("/sign-in");

  after(() => { void incrementUserReviewViewCount(id); });

  return <UserContentPage id={id} />;
}
