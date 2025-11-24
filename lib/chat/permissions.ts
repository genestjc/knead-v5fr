import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { createThirdwebClient, getContract } from 'thirdweb';
import { getOwnedNFTs } from 'thirdweb/extensions/erc1155';
import { base } from 'thirdweb/chains';
import type { SupabaseClient } from '@supabase/supabase-js';

// --- CONFIG & SETUP ---

const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY;
const CONTRIBUTOR_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS;
const MEMBERSHIP_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS;

if (!THIRDWEB_SECRET_KEY || !CONTRIBUTOR_CONTRACT_ADDRESS || !MEMBERSHIP_CONTRACT_ADDRESS) {
  throw new Error("Missing critical Thirdweb or Contract environment variables for permissions.");
}

const client = createThirdwebClient({ secretKey: THIRDWEB_SECRET_KEY });
const contributorContract = getContract({ client, address: CONTRIBUTOR_CONTRACT_ADDRESS, chain: base });
const membershipContract = getContract({ client, address: MEMBERSHIP_CONTRACT_ADDRESS, chain: base });

const CONTRIBUTOR_TOKEN_IDS: bigint[] = [10n, 11n, 12n];
const PREMIUM_TOKEN_ID: bigint = 1n;

// Per ThirdWeb AI: Add minimal address validation to fail fast.
const isAddress = (address: unknown): address is string => {
    return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address);
}

// --- ON-CHAIN HELPERS ---

/**
 * CORE on-chain check: Verifies if a user holds a Contributor NFT.
 * @param userAddress The wallet address.
 * @returns Promise<boolean>
 */
async function isContributor(userAddress: string): Promise<boolean> {
    if (!isAddress(userAddress)) return false;
    try {
        const nfts = await getOwnedNFTs({ contract: contributorContract, owner: userAddress });
        // Per ThirdWeb AI: Comparison is safe as `nfts.id` is bigint and our array contains bigints.
        return nfts.some(nft => CONTRIBUTOR_TOKEN_IDS.includes(nft.id));
    } catch (error) {
        console.error(`On-chain contributor check failed for ${userAddress}:`, error);
        return false;
    }
}

/**
 * On-chain check for Premium Membership NFT (Token ID 1).
 * @param userAddress The wallet address.
 * @returns Promise<boolean>
 */
async function isPremiumMember(userAddress: string): Promise<boolean> {
    if (!isAddress(userAddress)) return false;
    try {
        const nfts = await getOwnedNFTs({ contract: membershipContract, owner: userAddress });
        return nfts.some(nft => nft.id === PREMIUM_TOKEN_ID);
    } catch (error) {
        console.error(`On-chain premium check failed for ${userAddress}:`, error);
        return false;
    }
}


// --- OFF-CHAIN (SUPABASE) HELPERS ---

/**
 * Checks if a live event is currently active.
 * @param supabase - An active Supabase client instance.
 * @returns Promise<boolean>
 */
async function isLiveEventActive(supabase: SupabaseClient): Promise<boolean> {
  const { count, error } = await supabase
    .from('chat_events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'live');
  if (error) {
    console.error("Permissions Error: Could not check for active events.", error);
    return false;
  }
  return (count ?? 0) > 0;
}

/**
 * Simple helper to check for admin roles from a user object.
 * @param user - A user object with a `role` property.
 */
export function isAdmin(user: { role?: string }): boolean {
  return user?.role === 'admin' || user?.role === 'master-admin';
}


// --- PRIMARY HYBRID PERMISSION FUNCTIONS ---

/**
 * Determines if a user can post in a channel. Orchestrates on-chain and off-chain checks.
 * Per ThirdWeb AI: This layered check (admin -> contributor -> premium+event) is a solid pattern.
 * @param userId The user's ID from the users table.
 * @returns Promise<boolean>
 */
export async function canPostInChannel(userId: string): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { data: user, error } = await supabase.from('chat_users').select('id, address, role, is_banned').eq('id', userId).single();

  if (error || !user || user.is_banned) return false;
  if (!isAddress(user.address)) return false; // Validate address before on-chain calls
  
  if (isAdmin(user)) return true;

  // Per ThirdWeb AI: Parallelize on-chain checks for efficiency.
  const [isUserContributor, isUserPremium] = await Promise.all([
    isContributor(user.address),
    isPremiumMember(user.address)
  ]);
  
  if (isUserContributor) return true;
  
  if (isUserPremium) {
    return isLiveEventActive(supabase);
  }

  return false;
}

/**
 * Determines if a user can view a channel's content.
 * NOTE: Freemium logic is handled by the relevant API route (`/api/chat/messages`).
 * @param userId The user's ID from the users table.
 * @returns Promise<boolean>
 */
export async function canViewChannel(userId: string): Promise<boolean> {
    const supabase = createSupabaseAdmin();
    const { data: user, error } = await supabase.from('chat_users').select('id, address, is_banned').eq('id', userId).single();

    if (error || !user || user.is_banned) return false;
    if (!isAddress(user.address)) return false;

    // Per ThirdWeb AI: For future scaling, these parallel checks could be batched using multicall.
    const [isUserContributor, isUserPremium] = await Promise.all([
        isContributor(user.address),
        isPremiumMember(user.address)
    ]);
    
    return isUserContributor || isUserPremium;
}
