import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type Profile = {
  id: string;
  email: string;
  role: string;
  tier: string;
  notification_enabled: boolean;
  full_name: string | null;
  phone: string | null;
  username: string | null;
  password_hash: string | null;
  icon_image: string | null;
  created_at: string;
  username_registered_at: string | null;
  username_change_count: number;
};

type SyncProfileInput = {
  email: string | null | undefined;
  fullName?: string | null;
};

const PROFILE_SELECT_COLUMNS =
  "id, email, role, tier, notification_enabled, full_name, phone, username, password_hash, icon_image, created_at, username_registered_at, username_change_count, last_visited_at, visit_count";
const PROFILE_SELECT_COLUMNS_LEGACY =
  "id, email, role, full_name, phone, username, password_hash, icon_image, created_at, username_registered_at, username_change_count";

function normalizeProfile(row: any): Profile {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    tier: row.tier ?? "general",
    notification_enabled: row.notification_enabled ?? true,
    full_name: row.full_name ?? null,
    phone: row.phone ?? null,
    username: row.username ?? null,
    password_hash: row.password_hash ?? null,
    icon_image: row.icon_image ?? null,
    created_at: row.created_at,
    username_registered_at: row.username_registered_at ?? null,
    username_change_count: row.username_change_count ?? 0,
  };
}

export async function syncProfile({ email, fullName }: SyncProfileInput) {
  if (!email) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const normalizedEmail = email.toLowerCase();
  let hasNotificationColumn = true;

  let { data: existingProfile, error: fetchError } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT_COLUMNS)
    .eq("email", normalizedEmail)
    .maybeSingle<any>();

  if (fetchError?.code === "42703") {
    hasNotificationColumn = false;
    const legacy = await supabase
      .from("profiles")
      .select(PROFILE_SELECT_COLUMNS_LEGACY)
      .eq("email", normalizedEmail)
      .maybeSingle<any>();
    existingProfile = legacy.data;
    fetchError = legacy.error;
  }

  if (fetchError) {
    throw fetchError;
  }

  if (existingProfile) {
    if (fullName && existingProfile.full_name !== fullName) {
      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", existingProfile.id)
        .select(hasNotificationColumn ? PROFILE_SELECT_COLUMNS : PROFILE_SELECT_COLUMNS_LEGACY)
        .single<any>();

      if (updateError) {
        throw updateError;
      }

      return normalizeProfile(updatedProfile);
    }

    return normalizeProfile(existingProfile);
  }

  const insertPayload: Record<string, unknown> = {
    id: randomUUID(),
    email: normalizedEmail,
    role: "member",
    full_name: fullName ?? null,
  };
  if (hasNotificationColumn) {
    insertPayload.notification_enabled = true;
  }

  let { data: createdProfile, error: insertError } = await supabase
    .from("profiles")
    .insert(insertPayload)
    .select(hasNotificationColumn ? PROFILE_SELECT_COLUMNS : PROFILE_SELECT_COLUMNS_LEGACY)
    .single<any>();

  if (insertError?.code === "42703" && hasNotificationColumn) {
    hasNotificationColumn = false;
    const fallbackCreated = await supabase
      .from("profiles")
      .insert({
        id: insertPayload.id,
        email: normalizedEmail,
        role: "member",
        full_name: fullName ?? null,
      })
      .select(PROFILE_SELECT_COLUMNS_LEGACY)
      .single<any>();
    createdProfile = fallbackCreated.data;
    insertError = fallbackCreated.error;
  }

  if (insertError) {
    throw insertError;
  }

  return normalizeProfile(createdProfile);
}
