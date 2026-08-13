import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "./config";

export function createClient() {
  const config = getSupabasePublicConfig();
  if (!config) throw new Error("Supabase is not configured. Add the public project URL and publishable key.");
  return createBrowserClient(config.url, config.publishableKey);
}
