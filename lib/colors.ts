import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ColorItem } from "@/lib/color-types";

const COLOR_SELECT =
  "id, title, content, price, file_link, img_standard_full, img_standard_mid, img_standard_thumb, img_portrait_full, img_portrait_mid, img_portrait_thumb, img_arao_full, img_arao_mid, img_arao_thumb, like_count, created_at, is_admin";

export async function getColorList(limit = 30): Promise<ColorItem[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("colors")
    .select(COLOR_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getColorById(id: string): Promise<ColorItem | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("colors")
    .select(COLOR_SELECT)
    .eq("id", id)
    .maybeSingle<ColorItem>();

  if (error) {
    throw error;
  }

  return data ?? null;
}
