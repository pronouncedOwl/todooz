/** Custom schema in the shared Supabase project (not public). */
export const SUPABASE_DB_SCHEMA = "todooz";

export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

/** Publishable key (preferred) or legacy anon key. */
export function getSupabasePublishableKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  );
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}

export function supabaseClientOptions() {
  return { db: { schema: SUPABASE_DB_SCHEMA } };
}
