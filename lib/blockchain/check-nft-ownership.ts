/**
 * NFT Ownership Detection for Role-Based Permissions
 * 
 * This module replaces Supabase role checks with blockchain-based NFT ownership verification.
 * 
 * Token Ownership Model:
 * - Freemium: Owns Token ID 0 ONLY (no Token ID 1, no Contributor NFT)
 * - Participant: Owns Token ID 0 + Token ID 1 OR has Event Pass
 * - Contributor: Owns Token ID 0 + Contributor NFT (Token ID 1, 2, or 3)
 */

import { getContract, readContract } from "thirdweb";
import { client as thirdwebClient, activeChain } from "@/thirdweb-client";

// Server-side in-memory cache — avoids redundant RPC calls on every permission check.
// TTL is intentionally short enough to catch NFT purchases but long enough to cut RPS 10-20x.
const NFT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const nftRoleCache = new Map<string, { result: UserRoleInfo; expiresAt: number }>();

export type UserRole = 'freemium' | 'participant' | 'contributor';

export interface UserRoleInfo {
  role: UserRole;
  hasKneadMonthly: boolean;
  hasContributor: boolean;
  hasEventPass: boolean;
  eventId?: string;
  contributorTokenId?: number; // 1, 2, or 3
}

/**
 * Strict balance read for Knead Monthly (Token ID 1).
 *
 * Returns true/false ONLY when the chain answered. Throws on a transient RPC
 * failure so callers can tell "confirmed does NOT own" apart from "couldn't
 * check right now" — the distinction getUserRole relies on to avoid downgrading
 * a paying member to freemium when the RPC blips.
 */
async function readKneadMonthlyStrict(address: string): Promise<boolean> {
  const nftContractAddress = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS;
  if (!nftContractAddress) {
    // Missing config is a definitive "can't own", not a transient error.
    console.warn("❌ NEXT_PUBLIC_NFT_CONTRACT_ADDRESS is not set");
    return false;
  }

  const contract = getContract({
    client: thirdwebClient,
    chain: activeChain,
    address: nftContractAddress,
  });

  const balance = await readContract({
    contract,
    method: "function balanceOf(address account, uint256 id) view returns (uint256)",
    params: [address, BigInt(1)],
  });

  return Number(balance) > 0;
}

/**
 * Strict contributor balance read (Token ID 1, 2, or 3).
 * Throws on RPC failure; returns a confirmed result otherwise.
 */
async function readContributorStrict(address: string): Promise<{
  isContributor: boolean;
  tokenId?: number;
}> {
  const contributorContractAddress = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS;
  if (!contributorContractAddress) {
    console.warn("NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS is not set");
    return { isContributor: false };
  }

  const contract = getContract({
    client: thirdwebClient,
    chain: activeChain,
    address: contributorContractAddress,
  });

  const tokenIds = [1, 2, 3]; // Appointed, Invited, Earned

  for (const tokenId of tokenIds) {
    const balance = await readContract({
      contract,
      method: "function balanceOf(address account, uint256 id) view returns (uint256)",
      params: [address, BigInt(tokenId)],
    });

    if (Number(balance) > 0) {
      return { isContributor: true, tokenId };
    }
  }

  return { isContributor: false };
}

/**
 * Check if user owns Knead Monthly subscription (Token ID 1)
 *
 * Public contract preserved: returns false on RPC error (callers treat false as
 * "not a member"). getUserRole does NOT use this — it uses the strict reader so
 * it can handle errors without silently downgrading members.
 */
export async function hasKneadMonthly(address: string): Promise<boolean> {
  try {
    return await readKneadMonthlyStrict(address);
  } catch (error) {
    console.error("❌ Error checking Knead Monthly NFT:", error);
    return false;
  }
}

/**
 * Check if user is a contributor (owns Token ID 1, 2, or 3)
 */
export async function isContributor(address: string): Promise<{
  isContributor: boolean;
  tokenId?: number
}> {
  try {
    return await readContributorStrict(address);
  } catch (error) {
    console.error("Error checking contributor NFT:", error);
    return { isContributor: false };
  }
}

/**
 * ✅ UPDATED: Check if user has an active Event Pass
 */
export async function hasEventPass(address: string): Promise<{
  hasPass: boolean;
  eventId?: string;
}> {
  try {
    const eventPassContract = process.env.NEXT_PUBLIC_EVENT_PASS_CONTRACT;
    
    // ✅ If Event Pass contract not configured, skip check silently
    if (!eventPassContract || eventPassContract === 'undefined') {
      // Don't log warning - this is optional feature
      return { hasPass: false };
    }

    const contract = getContract({
      client: thirdwebClient,
      chain: activeChain,
      address: eventPassContract,
    });

    // ✅ Try to check if user has active pass
    try {
      const hasPass = await readContract({
        contract,
        method: "function hasActivePass(address user) view returns (bool)",
        params: [address],
      });

      if (!hasPass) {
        return { hasPass: false };
      }

      // ✅ Try to get event ID if they have a pass
      try {
        const eventId = await readContract({
          contract,
          method: "function getUserEventId(address user) view returns (string)",
          params: [address],
        });
        
        return { hasPass: true, eventId };
      } catch (e) {
        // User has pass but can't get event ID - that's OK
        return { hasPass: true };
      }
    } catch (contractError: any) {
      // ✅ Contract method doesn't exist or other error - silently fail
      console.log('[Event Pass] Contract check skipped:', contractError.message);
      return { hasPass: false };
    }
  } catch (error) {
    // ✅ Don't log error - Event Pass is optional
    return { hasPass: false };
  }
}

/**
 * Get user's role based on NFT ownership, with server-side cache to reduce RPC load.
 * Pass force=true to bypass cache (e.g. after minting an NFT).
 *
 * Priority: Contributor > Participant (Monthly OR Event Pass) > Freemium
 */
export async function getUserRole(address: string, force = false): Promise<UserRoleInfo> {
  const cacheKey = address.toLowerCase();
  if (!force) {
    const cached = nftRoleCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }
  }

  try {
    // Use the STRICT readers so an RPC failure throws (instead of masquerading as
    // "owns nothing"). Check NFT ownership in parallel (Event Pass is now tracked
    // in Supabase, not on-chain).
    const [hasMonthly, contributorCheck] = await Promise.all([
      readKneadMonthlyStrict(address),
      readContributorStrict(address),
    ]);

    // Determine role based on priority
    let role: UserRole = 'freemium';

    if (contributorCheck.isContributor) {
      role = 'contributor';
    } else if (hasMonthly) {
      role = 'participant';
    }

    const result: UserRoleInfo = {
      role,
      hasKneadMonthly: hasMonthly,
      hasContributor: contributorCheck.isContributor,
      hasEventPass: false, // Event Pass is now checked directly in permissions API via Supabase
      contributorTokenId: contributorCheck.tokenId,
    };

    // Only cache results the chain actually confirmed.
    nftRoleCache.set(cacheKey, { result, expiresAt: Date.now() + NFT_CACHE_TTL_MS });
    return result;
  } catch (error) {
    console.error("Error getting user role:", error);

    // Transient RPC failure. Do NOT downgrade a member we've already resolved —
    // that's what made the chat input flap (appear, then vanish) for Knead Monthly
    // members. Serve the last-known-good role even if its TTL has lapsed, and give
    // it a short grace window so we recover quickly without hammering the RPC.
    const stale = nftRoleCache.get(cacheKey);
    if (stale) {
      stale.expiresAt = Math.max(stale.expiresAt, Date.now() + 30 * 1000);
      return stale.result;
    }

    // Never resolved this address before — fail safe to freemium, but DON'T cache
    // it, so the very next call retries the chain.
    return {
      role: 'freemium',
      hasKneadMonthly: false,
      hasContributor: false,
      hasEventPass: false,
    };
  }
}

/**
 * Get contributor type name from token ID
 */
export function getContributorTypeName(tokenId?: number): string {
  switch (tokenId) {
    case 1:
      return 'Appointed';
    case 2:
      return 'Invited';
    case 3:
      return 'Earned';
    default:
      return 'Unknown';
  }
}
