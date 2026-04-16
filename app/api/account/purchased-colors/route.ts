import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncProfile } from "@/lib/profiles";

const SUCCESS_ORDER_STATUSES = ["결제완료", "발송완료"] as const;

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ purchasedColorIds: [] as string[] });
    }

    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;
    const profile = await syncProfile({ email, fullName });
    if (!profile) {
      return NextResponse.json({ purchasedColorIds: [] as string[] });
    }

    const admin = createSupabaseAdminClient();
    const { data: orders, error: ordersError } = await admin
      .from("orders")
      .select("id")
      .eq("user_id", profile.id)
      .in("status", [...SUCCESS_ORDER_STATUSES]);

    if (ordersError) {
      throw ordersError;
    }

    const orderIds = (orders ?? []).map((order) => order.id);
    if (orderIds.length === 0) {
      return NextResponse.json({ purchasedColorIds: [] as string[] });
    }

    const { data: items, error: itemsError } = await admin
      .from("order_items")
      .select("color_id")
      .in("order_id", orderIds);

    if (itemsError) {
      throw itemsError;
    }

    const purchasedColorIds = [
      ...new Set(
        (items ?? [])
          .map((item) => item.color_id)
          .filter((colorId): colorId is string => typeof colorId === "string" && colorId.trim().length > 0)
      ),
    ];

    return NextResponse.json({ purchasedColorIds });
  } catch (error) {
    console.error("GET /api/account/purchased-colors error:", error);
    return NextResponse.json({ purchasedColorIds: [] as string[] });
  }
}
