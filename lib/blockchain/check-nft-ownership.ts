/**
 * NFT Ownership Detection for Role-Based Permissions
 * 
 * This module replaces Supabase role checks with blockchain-based NFT ownership verification.
 * 
 * Token Ownership Model:
 * - Freemium: Owns Token ID 0 ONLY (no Token ID 1, no Contributor NFT)
 * - Participant: Owns Token ID 0 + Token ID 1
 * - Contributor: Owns Token ID 0 + Contributor NFT (Token ID 1, 2, or 3)
 * 
 * Contributor Token IDs (KneadContributors contract):
 * - Token ID 1: Appointed Contributor (0.8x multiplier)
 * - Token ID 2: Invited Contributor (1.0x multiplier)
 * - Token ID 3: Earned Contributor (1.5x multiplier)
 */

import { getContract, readContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { client as thirdwebClient } from "@/thirdweb-client";

export type UserRole = 'freemium' | 'participant' | 'contributor';

export interface UserRoleInfo {
  role: UserRole;
  hasKneadMonthly: boolean;
  hasContributor: boolean;
  contributorTokenId?: number; // 1, 2, or 3
}

/**
 * Check if user owns Knead Monthly subscription (Token ID 1)
 * 
 * @param address - User's wallet address
 * @returns True if user owns Token ID 1
 */
export async function hasKneadMonthly(address: string): Promise<boolean> {
  try {
    const nftContractAddress = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS;
    
    if (!nftContractAddress) {
      console.warn("NEXT_PUBLIC_NFT_CONTRACT_ADDRESS is not set");
      return false;
    }

    const contract = getContract({
      client: thirdwebClient,
      chain: base,
      address: nftContractAddress,
    });

    // Check ERC1155 balance for Token ID 1 (Knead Monthly)
    const balance = await readContract({
      contract,
      method: "function balanceOf(address account, uint256 id) view returns (uint256)",
      params: [address, BigInt(1)],
    });

    return Number(balance) > 0;
  } catch (error) {
    console.error("Error checking Knead Monthly NFT:", error);
    return false;
  }
}

/**
 * Check if user is a contributor (owns Token ID 1, 2, or 3)
 * 
 * @param address - User's wallet address
 * @returns Object with contributor status and token ID
 */
export async function isContributor(address: string): Promise<{ 
  isContributor: boolean; 
  tokenId?: number 
}> {
  try {
    const contributorContractAddress = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS;
    
    if (!contributorContractAddress) {
      console.warn("NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS is not set");
      return { isContributor: false };
    }

    const contract = getContract({
      client: thirdwebClient,
      chain: base,
      address: contributorContractAddress,
    });

    // ✅ FIXED: Changed from [10, 11, 12] to [1, 2, 3]
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
  } catch (error) {
    console.error("Error checking contributor NFT:", error);
    return { isContributor: false };
  }
}

/**
 * Get user's role based on NFT ownership
 * 
 * Priority: Contributor > Participant > Freemium
 * 
 * @param address - User's wallet address
 * @returns User role information
 */
export async function getUserRole(address: string): Promise<UserRoleInfo> {
  try {
    // Check both NFT types in parallel
    const [hasMonthly, contributorCheck] = await Promise.all([
      hasKneadMonthly(address),
      isContributor(address),
    ]);

    // Determine role based on priority
    let role: UserRole = 'freemium';
    
    if (contributorCheck.isContributor) {
      role = 'contributor';
    } else if (hasMonthly) {
      role = 'participant';
    }

    return {
      role,
      hasKneadMonthly: hasMonthly,
      hasContributor: contributorCheck.isContributor,
      contributorTokenId: contributorCheck.tokenId,
    };
  } catch (error) {
    console.error("Error getting user role:", error);
    
    // Fail-safe: return freemium role if we can't determine
    return {
      role: 'freemium',
      hasKneadMonthly: false,
      hasContributor: false,
    };
  }
}

/**
 * Get contributor type name from token ID
 * 
 * @param tokenId - Token ID (1, 2, or 3)
 * @returns Contributor type name
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
