import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getColorById } from "@/lib/colors";

function normalizeProductCode(input?: string | null): string | null {
  const raw = (input ?? "").trim().toLowerCase();
  if (!raw) return null;

  const normalized = raw.replace(/\s+/g, "-");
  if (!/^[a-z0-9][a-z0-9_-]{1,48}[a-z0-9]$/.test(normalized)) {
    throw new Error("상품코드는 영문 소문자, 숫자, -, _ 만 사용할 수 있습니다. (3~50자)");
  }
  return normalized;
}

type MissingOptionalColumn = "product_code" | "creator" | "creator_icon";

function getMissingOptionalColorColumn(
  error: { code?: string; message?: string } | null
): MissingOptionalColumn | null {
  if (error?.code !== "42703") return null;
  const message = error.message ?? "";
  if (message.includes("creator_icon")) return "creator_icon";
  if (message.includes("creator")) return "creator";
  if (message.includes("product_code")) return "product_code";
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  void request;

  try {
    const { id } = await params;
    const item = await getColorById(id);

    if (!item) {
      return NextResponse.json({ message: "컬러를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error("GET /api/color/[id] error:", error);
    return NextResponse.json({ message: "컬러 정보를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });

  const supabaseAuth = createSupabaseAdminClient();
  const { data: requestProfile } = await supabaseAuth
    .from("profiles")
    .select("role")
    .eq("clerk_id", userId)
    .maybeSingle();
  if (requestProfile?.role !== "admin") {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = (await request.json()) as {
      title?: string;
      product_code?: string | null;
      creator?: string | null;
      creator_icon?: string | null;
      content?: string | null;
      price?: number | null;
      img_standard_full?: string | null;
      img_standard_mid?: string | null;
      img_standard_thumb?: string | null;
      img_portrait_full?: string | null;
      img_portrait_mid?: string | null;
      img_portrait_thumb?: string | null;
      img_arao_full?: string | null;
      img_arao_mid?: string | null;
      img_arao_thumb?: string | null;
      file_link?: string | null;
    };
    const creator = body.creator?.trim() || null;
    const creatorIcon = body.creator_icon?.trim() || null;
    let productCode: string | null;
    try {
      productCode = normalizeProductCode(body.product_code);
    } catch (error) {
      const message = error instanceof Error ? error.message : "상품코드 형식이 올바르지 않습니다.";
      return NextResponse.json({ message }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("colors")
      .update({
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.product_code !== undefined ? { product_code: productCode } : {}),
        ...(body.creator !== undefined ? { creator } : {}),
        ...(body.creator_icon !== undefined ? { creator_icon: creatorIcon } : {}),
        ...(body.content !== undefined ? { content: body.content } : {}),
        ...(body.price !== undefined ? { price: body.price } : {}),
        img_standard_full: body.img_standard_full ?? null,
        img_standard_mid: body.img_standard_mid ?? null,
        img_standard_thumb: body.img_standard_thumb ?? null,
        img_portrait_full: body.img_portrait_full ?? null,
        img_portrait_mid: body.img_portrait_mid ?? null,
        img_portrait_thumb: body.img_portrait_thumb ?? null,
        img_arao_full: body.img_arao_full ?? null,
        img_arao_mid: body.img_arao_mid ?? null,
        img_arao_thumb: body.img_arao_thumb ?? null,
        ...(body.file_link !== undefined ? { file_link: body.file_link } : {}),
      })
      .eq("id", id);

    if (error) {
      const missingColumn = getMissingOptionalColorColumn(error);
      if (missingColumn === "creator_icon") {
        return NextResponse.json(
          { message: "DB에 creator_icon 컬럼이 아직 없습니다. SQL 반영 후 다시 시도해주세요." },
          { status: 400 }
        );
      }
      if (missingColumn === "creator") {
        return NextResponse.json(
          { message: "DB에 creator 컬럼이 아직 없습니다. SQL 반영 후 다시 시도해주세요." },
          { status: 400 }
        );
      }
      if (missingColumn === "product_code") {
        return NextResponse.json(
          { message: "DB에 product_code 컬럼이 아직 없습니다. SQL 반영 후 다시 시도해주세요." },
          { status: 400 }
        );
      }
      const duplicateKeyText = `${error.message} ${error.details ?? ""} ${error.hint ?? ""}`;
      if (error.code === "23505" && duplicateKeyText.includes("colors_product_code_key")) {
        return NextResponse.json({ message: "이미 사용 중인 상품코드입니다." }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/color/[id] error:", error);
    return NextResponse.json({ message: "업데이트에 실패했습니다." }, { status: 500 });
  }
}
