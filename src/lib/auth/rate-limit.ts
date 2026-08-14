import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

interface LimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export async function consumeAuthLimit(scope: string, subject: string, limit: number, windowSeconds: number): Promise<LimitResult> {
  const supabase = await createClient();
  const key = hashLimitKey(scope, subject);
  const { data, error } = await supabase.rpc("consume_auth_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error("Auth rate limit check failed", error.message);
    return { allowed: false, retryAfterSeconds: 60 };
  }

  const result = data as { allowed?: unknown; retry_after_seconds?: unknown } | null;
  return {
    allowed: result?.allowed === true,
    retryAfterSeconds: typeof result?.retry_after_seconds === "number" ? result.retry_after_seconds : 0,
  };
}

export async function clearAuthLimit(scope: string, subject: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_auth_rate_limit", { p_key: hashLimitKey(scope, subject) });
  if (error) console.error("Could not clear auth rate limit", error.message);
}

export async function getClientAddress() {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || requestHeaders.get("x-real-ip")?.trim() || "unknown";
}

export function retryMessage(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Too many attempts. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

function hashLimitKey(scope: string, subject: string) {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET;
  if (!secret) console.warn("AUTH_RATE_LIMIT_SECRET is not configured; using the public Supabase key as a fallback pepper.");
  const fallback = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "cjnet-photodesk";
  return createHash("sha256").update(`${secret || fallback}:${scope}:${subject}`).digest("hex");
}
