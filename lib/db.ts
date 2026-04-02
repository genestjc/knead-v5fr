import { getSupabaseAdmin } from "@/lib/supabase/server"

/**
 * Supabase Service-Role client (server-side only).
 * For RLS-safe public access use a separate anon client.
 *
 *   import { supabaseAdmin } from "@/lib/db"
 */
export const supabaseAdmin = getSupabaseAdmin()
