/**
 * Contributor NFT Permission System
 * 
 * NFT-based contributor permissions replacing database flags.
 * Contributor roles are determined by NFT ownership and metadata.
 */

import { getContract, readContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { client as thirdwebClient } from "@/thirdweb-client";

export type ContributorType = 'appointed' | 'earned' | 'invited' | null;

/**
 * Check if user is a contributor via NFT ownership
 * 
 * @param address - User's wallet address
 * @returns Object with contributor status and token ID
 */
export async function isContributor(address: string): Promise<{ 
  isContributor: boolean; 
  tokenId?: number 
}> {
  try {
    const nftContractAddress = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS;
    
    // If no NFT contract is configured, fall back to false
    if (!nftContractAddress) {
      console.warn("NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS is not set");
      return { isContributor: false };
    }

    const contract = getContract({
      client: thirdwebClient,
      chain: base,
      address: nftContractAddress,
    });

    // Check ERC1155 token IDs [1, 2, 3] for Appointed, Invited, Earned
    const tokenIds = [1, 2, 3];
    
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
    // Fail-open: if we can't check, assume not a contributor
    return { isContributor: false };
  }
}

/**
 * Get contributor type from NFT token ID
 * 
 * @param address - User's wallet address
 * @returns Contributor type or null if not a contributor
 */
export async function getContributorType(address: string): Promise<ContributorType> {
  try {
    const contributorCheck = await isContributor(address);
    
    if (!contributorCheck.isContributor || !contributorCheck.tokenId) {
      return null;
    }

    // Map token ID to contributor type
    switch (contributorCheck.tokenId) {
      case 1:
        return 'appointed';
      case 2:
        return 'invited';
      case 3:
        return 'earned';
      default:
        return null;
    }
  } catch (error) {
    console.error("Error getting contributor type:", error);
    return null;
  }
}

/**
 * Get contributor type ID from wallet address
 * 
 * @param address - User's wallet address
 * @returns Token ID (1, 2, or 3) or null if not a contributor
 */
export async function getContributorTypeId(address: string): Promise<number | null> {
  try {
    const contributorCheck = await isContributor(address);
    return contributorCheck.isContributor ? contributorCheck.tokenId || null : null;
  } catch (error) {
    console.error("Error getting contributor type ID:", error);
    return null;
  }
}

/**
 * Get contributor multiplier based on token ID
 * 
 * @param address - User's wallet address
 * @returns Multiplier (0.8x, 1.0x, or 1.5x) or 0 if not a contributor
 */
export async function getContributorMultiplier(address: string): Promise<number> {
  try {
    const contributorCheck = await isContributor(address);
    
    if (!contributorCheck.isContributor || !contributorCheck.tokenId) {
      return 0;
    }

    // Map token ID to multiplier
    switch (contributorCheck.tokenId) {
      case 1: // Appointed
        return 0.8;
      case 2: // Invited
        return 1.0;
      case 3: // Earned
        return 1.5;
      default:
        return 0;
    }
  } catch (error) {
    console.error("Error getting contributor multiplier:", error);
    return 0;
  }
}

/**
 * Get contributor's weekly token budget based on their NFT type
 * 
 * @param contributorType - Type of contributor
 * @returns Weekly budget in $TOWNS tokens
 */
export function getWeeklyBudget(contributorType: ContributorType): number {
  if (!contributorType) return 0;
  
  const budgets = {
    appointed: 12,    // 12 $TOWNS per week
    invited: 10,      // 10 $TOWNS per week
    earned: 15,       // 15 $TOWNS per week
  };
  
  return budgets[contributorType] || 0;
}

/**
 * Verify contributor has sufficient balance for an award
 * 
 * @param contributorAddress - Contributor's wallet address
 * @param amount - Amount they want to award
 * @returns True if they have sufficient balance
 */
export async function hassufficientBalance(
  contributorAddress: string,
  amount: number
): Promise<boolean> {
  try {
    const { getUserTownsBalance } = await import("./towns-utils");
    const balance = await getUserTownsBalance(contributorAddress);
    return balance >= amount;
  } catch (error) {
    console.error("Error checking contributor balance:", error);
    return false;
  }
}
