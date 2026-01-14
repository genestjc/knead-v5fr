import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Singleton pattern for Supabase admin client
 * Reduces initialization overhead and ensures consistent configuration
 */
let _supabaseAdmin: SupabaseClient | null = null;

/**
 * Get or create Supabase admin client (singleton)
 * Uses service role key for server-side operations with elevated permissions
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (_supabaseAdmin) {
    return _supabaseAdmin;
  }
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }
  
  _supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  return _supabaseAdmin;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetSupabaseAdmin(): void {
  _supabaseAdmin = null;
}
