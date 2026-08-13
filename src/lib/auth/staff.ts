import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type StaffRole = "admin" | "staff";

export interface StaffProfile {
  id: string;
  fullName: string;
  username: string;
  role: StaffRole;
  active: boolean;
}

export type StaffAuthorization =
  | { status: "unconfigured" }
  | { status: "unauthenticated" }
  | { status: "profile-missing" }
  | { status: "inactive"; profile: StaffProfile }
  | { status: "active"; profile: StaffProfile };

export async function getCurrentStaff(): Promise<StaffAuthorization> {
  if (!isSupabaseConfigured()) return { status: "unconfigured" };
  const supabase = await createClient();
  const { data: claimData, error: claimError } = await supabase.auth.getClaims();
  const userId = claimData?.claims?.sub;
  if (claimError || !userId) return { status: "unauthenticated" };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, username, role, active")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return { status: "profile-missing" };

  const profile: StaffProfile = {
    id: data.id,
    fullName: data.full_name,
    username: data.username,
    role: data.role as StaffRole,
    active: data.active,
  };
  return profile.active ? { status: "active", profile } : { status: "inactive", profile };
}

export async function requireActiveStaff(): Promise<StaffProfile> {
  const authorization = await getCurrentStaff();
  if (authorization.status !== "active") throw new Error("Active staff access is required.");
  return authorization.profile;
}
