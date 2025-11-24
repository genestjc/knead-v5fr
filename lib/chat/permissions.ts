import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { createThirdwebClient, getContract } from 'thirdweb';
import { getOwnedNFTs } from 'thirdweb/extensions/erc1155';
import { base } from 'thirdweb/chains';

// --- ON-CHAIN VERIFICATION SETUP ---
const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY;
const CONTRIBUTOR_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS;
const MEMBERSHIP_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS;

if (!THIRDWEB_SECRET_KEY || !CONTRIBUTOR_CONTRACT_ADDRESS || !MEMBERSHIP_CONTRACT_ADDRESS) {
  // This will cause a build-time error if ENVs are missing, which is good.
  throw new Error("Missing critical Thirdweb or Contract environment variables for permissions.");
}

const client = createThirdwebClient({ secretKey: THIRDWEB_SECRET_KEY });
const contributorContract = getContract({ client, address: CONTRIBUTOR_CONTRACT_ADDRESS, chain: base });
const membershipContract = getContract({ client, address: MEMBERSHIP_CONTRACT_ADDRESS, chain: base });

const CONTRIBUTOR_TOKEN_IDS = [10n, 11n, 12n];
const PREMIUM_TOKEN_ID = 1n;

/**
 * The CORE on-chain permission check.
 * Verifies if a user holds a Contributor NFT.
 * @param userAddress The wallet address.
 * @returns Promise<boolean>
 */
async function isContributor(userAddress: string): Promise<boolean> {
    if (!userAddress) return false;
    try {
        const nfts = await getOwnedNFTs({ contract: contributorContract, owner: userAddress });
        return nfts.some(nft => CONTRIBUTOR_TOKEN_IDS.includes(nft.id));
    } catch (error) {
        console.error(`On-chain contributor check failed for ${userAddress}:`, error);
        return false;
    }
}

/**
 * Checks on-chain if a user has a Premium Membership NFT (Token ID 1).
 * @param userAddress The wallet address.
 * @returns Promise<boolean>
 */
async function isPremiumMember(userAddress: string): Promise<boolean> {
    if (!userAddress) return false;
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
 * Checks if a live event is currently active. This is pure business logic.
 * @returns Promise<boolean>
 */
async function isLiveEventActive(): Promise<boolean> {
  const supabase = createSupabaseAdmin();
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
 * A simple helper to check for admin roles from a user object.
 * @param user - A user object with a `role` property.
 */
export function isAdmin(user: { role?: string }): boolean {
  return user?.role === 'admin' || user?.role === 'master-admin';
}


// --- HYBRID PERMISSION FUNCTIONS (The final logic) ---

/**
 * Determines if a user can post in a channel.
 * This is the heart of your new logic.
 */
export async function canPostInChannel(userId: string): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { data: user, error } = await supabase.from('chat_users').select('id, address, role, is_banned').eq('id', userId).single();

  if (error || !user || user.is_banned) return false;
  
  // Admins can always post.
  if (isAdmin(user)) return true;

  // Check for Contributor and Premium status in parallel for efficiency.
  const [isUserContributor, isUserPremium] = await Promise.all([
    isContributor(user.address),
    isPremiumMember(user.address)
  ]);
  
  // A contributor can always post.
  if (isUserContributor) return true;
  
  // A premium member can only post if a live event is active.
  if (isUserPremium) {
    return isLiveEventActive();
  }

  // Everyone else cannot post.
  return false;
}

/**
 * Determines if a user can view a channel.
 * Freemium logic is now handled directly by the API route that needs it,
 * so this function can be simplified to handle only on-chain roles.
 */
export async function canViewChannel(userId: string): Promise<boolean> {
    const supabase = createSupabaseAdmin();
    const { data: user, error } = await supabase.from('chat_users').select('id, address, is_banned').eq('id', userId).single();

    if (error || !user || user.is_banned) return false;

    // Anyone with a premium membership or a contributor NFT can view.
    const [isUserContributor, isUserPremium] = await Promise.all([
        isContributor(user.address),
        isPremiumMember(user.address)
    ]);
    
    // Note: Freemium logic is explicitly handled in the `GET /api/chat/messages` route now,
    // as it's tightly coupled with the freemium time-limit check.
    return isUserContributor || isUserPremium;
}
