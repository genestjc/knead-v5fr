import type { NextRequest } from 'next/server';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import {
  ADMIN_AUTH_HEADERS,
  ADMIN_AUTH_MAX_AGE_MS,
  buildAdminAuthMessage,
} from './message';

const DEFAULT_ADMIN_ROLES = ['master-admin', 'admin', 'moderator'];

// Public Base client used only to verify signatures (EOA off-chain recovery,
// with on-chain ERC-1271/6492 fallback for smart-account wallets).
const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'),
});

export interface AdminAuthResult {
  ok: boolean;
  /** Recovered + authorized wallet address (lowercase) when ok. */
  address?: string;
  /** 'master-admin' for the configured master wallet, else the DB role. */
  role?: string;
  error?: string;
  status?: number;
}

export interface VerifyAdminOptions {
  /** Require the configured master wallet; ignore DB roles. */
  requireMaster?: boolean;
  /** DB roles permitted when not the master wallet. Defaults to admin/moderator. */
  allowedRoles?: string[];
}

/**
 * Verifies a wallet-signature-authenticated admin request.
 *
 * Replaces the old (spoofable) pattern of trusting a client-supplied
 * `adminAddress`. The caller signs `buildAdminAuthMessage(...)` with their
 * wallet; we verify the signature against the claimed address (viem handles
 * EOA recovery plus ERC-1271 smart-account fallback), then check authorization
 * (master wallet or DB role). A 5-minute timestamp window blocks replay of a
 * captured signature.
 *
 * On success returns the verified address so routes can use it as the actor
 * (e.g. announcement `posted_by`) instead of a value the client could forge.
 */
export async function verifyAdminRequest(
  req: NextRequest,
  opts: VerifyAdminOptions = {},
): Promise<AdminAuthResult> {
  const address = req.headers.get(ADMIN_AUTH_HEADERS.address)?.toLowerCase();
  const timestamp = req.headers.get(ADMIN_AUTH_HEADERS.timestamp);
  const signature = req.headers.get(ADMIN_AUTH_HEADERS.signature);

  if (!address || !timestamp || !signature) {
    return { ok: false, error: 'Missing admin authentication', status: 401 };
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return { ok: false, error: 'Invalid admin address', status: 401 };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > ADMIN_AUTH_MAX_AGE_MS) {
    return { ok: false, error: 'Expired or invalid request timestamp', status: 401 };
  }

  let validSignature = false;
  try {
    validSignature = await publicClient.verifyMessage({
      address: address as `0x${string}`,
      message: buildAdminAuthMessage(address, timestamp),
      signature: signature as `0x${string}`,
    });
  } catch {
    validSignature = false;
  }
  if (!validSignature) {
    return { ok: false, error: 'Invalid signature', status: 401 };
  }

  // --- Authorization ---
  const master = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET?.toLowerCase();
  if (master && address === master) {
    return { ok: true, address, role: 'master-admin' };
  }
  if (opts.requireMaster) {
    return { ok: false, error: 'Master admin required', status: 403 };
  }

  const allowedRoles = opts.allowedRoles ?? DEFAULT_ADMIN_ROLES;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('chat_users')
    .select('role')
    .eq('address', address)
    .single();

  if (!data || !allowedRoles.includes(data.role)) {
    return { ok: false, error: 'Insufficient permissions', status: 403 };
  }
  return { ok: true, address, role: data.role };
}
