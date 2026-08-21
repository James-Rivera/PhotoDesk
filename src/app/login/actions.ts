"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSafeNextPath } from "@/lib/auth/redirects";
import { clearAuthLimit, consumeAuthLimit, getClientAddress, retryMessage } from "@/lib/auth/rate-limit";
import { sendPasswordHelpEmail } from "@/lib/auth/admin-email";
import { branchLocalCookieOptions, clearBranchLocalLoginAttempts, consumeBranchLocalLoginAttempt, createBranchLocalToken, isBranchLocalMode, LOCAL_AUTH_COOKIE, verifyBranchLocalPassword } from "@/lib/auth/local";
import { cookies } from "next/headers";

export interface LoginState {
  message: string | null;
}

export interface PasswordHelpState {
  status: "idle" | "success" | "error";
  message: string | null;
}

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  if (isBranchLocalMode()) {
    const username = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const nextPath = getSafeNextPath(formData.get("next"));
    if (!username || !password) return { message: "Enter both the local staff username and password." };
    const clientAddress = await getClientAddress();
    const accountLimit = consumeBranchLocalLoginAttempt(`account:${username}`);
    const addressLimit = consumeBranchLocalLoginAttempt(`address:${clientAddress}`);
    if (!accountLimit.allowed || !addressLimit.allowed) return { message: retryMessage(Math.max(accountLimit.retryAfterSeconds, addressLimit.retryAfterSeconds)) };
    if (!(await verifyBranchLocalPassword(username, password))) return { message: "The local staff username or password is incorrect." };
    clearBranchLocalLoginAttempts(`account:${username}`);
    clearBranchLocalLoginAttempts(`address:${clientAddress}`);
    const cookieStore = await cookies();
    cookieStore.set(LOCAL_AUTH_COOKIE, await createBranchLocalToken(), branchLocalCookieOptions);
    revalidatePath("/", "layout");
    redirect(nextPath);
  }
  if (!isSupabaseConfigured()) return { message: "Supabase is not configured on this deployment yet." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextPath = getSafeNextPath(formData.get("next"));
  if (!email || !password) return { message: "Enter both your email address and password." };
  if (email.length > 254 || password.length > 1_024) return { message: "The email address or password is too long." };

  const clientAddress = await getClientAddress();
  const [accountLimit, addressLimit] = await Promise.all([
    consumeAuthLimit("login-account", email, 5, 15 * 60),
    consumeAuthLimit("login-address", clientAddress, 30, 15 * 60),
  ]);
  if (!accountLimit.allowed || !addressLimit.allowed) {
    return { message: retryMessage(Math.max(accountLimit.retryAfterSeconds, addressLimit.retryAfterSeconds)) };
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError || !authData.user) return { message: "The email address or password is incorrect." };

  await clearAuthLimit("login-account", email);

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

export async function requestPasswordHelp(_: PasswordHelpState, formData: FormData): Promise<PasswordHelpState> {
  if (isBranchLocalMode()) return { status: "error", message: "Ask the branch administrator to reset the local PhotoDesk password." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || email.length > 254 || !email.includes("@")) {
    return { status: "error", message: "Enter the email address used for your staff account." };
  }
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "Password help is not configured on this deployment yet." };
  }

  const clientAddress = await getClientAddress();
  const [accountLimit, addressLimit] = await Promise.all([
    consumeAuthLimit("password-help-account", email, 3, 60 * 60),
    consumeAuthLimit("password-help-address", clientAddress, 10, 60 * 60),
  ]);
  if (!accountLimit.allowed || !addressLimit.allowed) {
    return { status: "error", message: retryMessage(Math.max(accountLimit.retryAfterSeconds, addressLimit.retryAfterSeconds)) };
  }

  const sent = await sendPasswordHelpEmail(email);
  if (!sent) return { status: "error", message: "The request could not be sent. Please contact the administrator directly." };

  return {
    status: "success",
    message: "Request sent. The administrator will contact you after checking your staff account.",
  };
}
