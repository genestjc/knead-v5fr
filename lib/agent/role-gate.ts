/**
 * Role gate for the Claude agent
 *
 * An address is permitted to issue commands when it holds either:
 *   • "admin" or "master-admin" role in the chat_users Supabase table, OR
 *   • a Contributor NFT (token IDs 1, 2, or 3) on Base
 *
 * Both checks run in parallel to minimise latency.
 */

import { getSupabaseAdmin } from '@/lib/supabase/server';
import { isContributor } from '@/lib/blockchain/check-nft-ownership';

export type AgentRole = 'admin' | 'contributor';

export interface RoleCheckResult {
  allowed: boolean;
  role: AgentRole | null;
}

/**
 * Determine whether a wallet address may issue agent commands.
 *
 * @param address - EVM wallet address (any casing)
 */
export async function getWalletAgentRole(address: string): Promise<RoleCheckResult> {
  const normalized = address.toLowerCase();

  const [supabaseRole, contributorCheck] = await Promise.all([
    checkSupabaseRole(normalized),
    isContributor(normalized).catch(() => ({ isContributor: false })),
  ]);

  if (supabaseRole === 'admin' || supabaseRole === 'master-admin') {
    return { allowed: true, role: 'admin' };
  }

  if (contributorCheck.isContributor) {
    return { allowed: true, role: 'contributor' };
  }

  return { allowed: false, role: null };
}

async function checkSupabaseRole(address: string): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('chat_users')
      .select('role')
      .eq('address', address)
      .single();
    return data?.role ?? null;
  } catch {
    return null;
  }
}
