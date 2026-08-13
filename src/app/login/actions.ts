"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSafeNextPath } from "@/lib/auth/redirects";

export interface LoginState {
  message: string | null;
}

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  if (!isSupabaseConfigured()) return { message: "Supabase is not configured on this deployment yet." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextPath = getSafeNextPath(formData.get("next"));
  if (!email || !password) return { message: "Enter both your email address and password." };
  if (email.length > 254 || password.length > 1_024) return { message: "The email address or password is too long." };

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError || !authData.user) return { message: "The email address or password is incorrect." };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return { message: "This account does not have a staff profile yet. Ask the shop administrator to finish its setup." };
  }
  if (!profile.active) {
    await supabase.auth.signOut();
    return { message: "This staff account is inactive. Ask the shop administrator for access." };
  }

  revalidatePath("/", "layout");
  redirect(nextPath);
}
