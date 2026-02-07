/**
 * NFT Ownership Detection for Role-Based Permissions
 * 
 * This module replaces Supabase role checks with blockchain-based NFT ownership verification.
 * 
 * Token Ownership Model:
 * - Freemium: Owns Token ID 0 ONLY (no Token ID 1, no Contributor NFT)
 * - Participant: Owns Token ID 0 + Token ID 1
 * - Contributor: Owns Token ID 0 + Contributor NFT (Token ID 10, 11, or 12)
 */

import { getContract, readContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { client as thirdwebClient } from "@/thirdweb-client";

export type UserRole = 'freemium' | 'participant' | 'contributor';

export interface UserRoleInfo {
  role: UserRole;
  hasKneadMonthly: boolean;
  hasContributor: boolean;
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
 * Check if user is a contributor (owns Token ID 10, 11, or 12)
 * 
 * @param address - User's wallet address
 * @returns True if user owns any contributor NFT
 */
export async function isContributor(address: string): Promise<boolean> {
  try {
    const contributorContractAddress = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS;
    
    if (!contributorContractAddress) {
      console.warn("NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS is not set");
      return false;
    }

    const contract = getContract({
      client: thirdwebClient,
      chain: base,
      address: contributorContractAddress,
    });

    // Check balances for Token IDs 10, 11, and 12
    const tokenIds = [10, 11, 12];
    
    for (const tokenId of tokenIds) {
      const balance = await readContract({
        contract,
        method: "function balanceOf(address account, uint256 id) view returns (uint256)",
        params: [address, BigInt(tokenId)],
      });
      
      if (Number(balance) > 0) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Error checking contributor NFT:", error);
    return false;
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
    const [hasMonthly, hasContributorNFT] = await Promise.all([
      hasKneadMonthly(address),
      isContributor(address),
    ]);

    // Determine role based on priority
    let role: UserRole = 'freemium';
    
    if (hasContributorNFT) {
      role = 'contributor';
    } else if (hasMonthly) {
      role = 'participant';
    }

    return {
      role,
      hasKneadMonthly: hasMonthly,
      hasContributor: hasContributorNFT,
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
