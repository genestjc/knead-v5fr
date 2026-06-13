import type { NextRequest } from 'next/server';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import {
  WALLET_AUTH_HEADERS,
  WALLET_AUTH_MAX_AGE_MS,
  buildWalletAuthMessage,
} from './wallet-message';

// Public Base client used only to verify signatures (EOA off-chain recovery,
// with on-chain ERC-1271/6492 fallback for smart-account wallets).
const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'),
});

export interface WalletAuthResult {
  ok: boolean;
  /** The verified wallet address (lowercase) when ok. */
  address?: string;
  error?: string;
  status?: number;
}

/**
 * Authenticates a wallet-signed request.
 *
 * This is *authentication only*: it proves the caller controls the private key
 * for the claimed address (viem handles EOA recovery plus the ERC-1271
 * smart-account fallback) and that the request is recent (5-minute window
 * blocks replay of a captured signature). It performs **no** authorization —
 * callers must run their own role/NFT/membership check against the returned
 * address.
 *
 * Replaces the spoofable pattern of trusting a client-supplied
 * `senderAddress` / `contributorAddress` / `address` field, where any public
 * wallet address could be pasted in to impersonate a privileged user.
 */
export async function verifyWalletRequest(
  req: NextRequest,
): Promise<WalletAuthResult> {
  const address = req.headers.get(WALLET_AUTH_HEADERS.address)?.toLowerCase();
  const timestamp = req.headers.get(WALLET_AUTH_HEADERS.timestamp);
  const signature = req.headers.get(WALLET_AUTH_HEADERS.signature);

  if (!address || !timestamp || !signature) {
    return { ok: false, error: 'Missing wallet authentication', status: 401 };
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return { ok: false, error: 'Invalid wallet address', status: 401 };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > WALLET_AUTH_MAX_AGE_MS) {
    return { ok: false, error: 'Expired or invalid request timestamp', status: 401 };
  }

  let validSignature = false;
  try {
    validSignature = await publicClient.verifyMessage({
      address: address as `0x${string}`,
      message: buildWalletAuthMessage(address, timestamp),
      signature: signature as `0x${string}`,
    });
  } catch {
    validSignature = false;
  }
  if (!validSignature) {
    return { ok: false, error: 'Invalid signature', status: 401 };
  }

  return { ok: true, address };
}
