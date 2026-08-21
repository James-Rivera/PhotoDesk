"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { branchLocalCookieOptions, isBranchLocalMode, LOCAL_AUTH_COOKIE } from "@/lib/auth/local";
import { cookies } from "next/headers";

export async function signOut() {
  if (isBranchLocalMode()) {
    const cookieStore = await cookies();
    cookieStore.set(LOCAL_AUTH_COOKIE, "", { ...branchLocalCookieOptions, maxAge: 0 });
  }
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/login");
}
