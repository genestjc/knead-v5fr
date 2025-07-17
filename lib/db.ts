import { createClient } from "@supabase/supabase-js"

/**
 * Supabase Service-Role client (server-side only).
 * For RLS-safe public access use a separate anon client.
 *
 *   import { supabaseAdmin } from "@/lib/db"
 */
export const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
