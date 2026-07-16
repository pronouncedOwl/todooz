import { createBrowserClient } from "@supabase/ssr";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
  supabaseClientOptions,
} from "@/lib/supabase/env";

export function createClient() {
  return createBrowserClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    supabaseClientOptions(),
  );
}
