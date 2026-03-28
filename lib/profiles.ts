import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type Profile = {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
  phone: string | null;
  username: string | null;
  password_hash: string | null;
  icon_image: string | null;
  created_at: string;
};

type SyncProfileInput = {
  email: string | null | undefined;
  fullName?: string | null;
};

export async function syncProfile({ email, fullName }: SyncProfileInput) {
  if (!email) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const normalizedEmail = email.toLowerCase();

  const { data: existingProfile, error: fetchError } = await supabase
    .from("profiles")
    .select("id, email, role, full_name, phone, username, password_hash, icon_image, created_at")
    .eq("email", normalizedEmail)
    .maybeSingle<Profile>();

  if (fetchError) {
    throw fetchError;
  }

  if (existingProfile) {
    if (fullName && existingProfile.full_name !== fullName) {
      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", existingProfile.id)
        .select("id, email, role, full_name, phone, username, password_hash, icon_image, created_at")
        .single<Profile>();

      if (updateError) {
        throw updateError;
      }

      return updatedProfile;
    }

    return existingProfile;
  }

  const { data: createdProfile, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: randomUUID(),
      email: normalizedEmail,
      role: "customer",
      full_name: fullName ?? null,
    })
    .select("id, email, role, full_name, phone, username, password_hash, icon_image, created_at")
    .single<Profile>();

  if (insertError) {
    throw insertError;
  }

  return createdProfile;
}
