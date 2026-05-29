import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getAllContributorHolders } from '@/lib/blockchain/get-contributors';

export type AgentRole = 'admin' | 'contributor';

export interface RoleCheckResult {
  allowed: boolean;
  role: AgentRole | null;
}

export async function getWalletAgentRole(address: string): Promise<RoleCheckResult> {
  const normalized = address.toLowerCase();

  const [supabaseRole, contributorHolders] = await Promise.all([
    checkSupabaseRole(normalized),
    getAllContributorHolders().catch(() => []),
  ]);

  if (supabaseRole === 'admin' || supabaseRole === 'master-admin') {
    return { allowed: true, role: 'admin' };
  }

  const isContributor = contributorHolders.some(h => h.address === normalized);
  if (isContributor) return { allowed: true, role: 'contributor' };

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
