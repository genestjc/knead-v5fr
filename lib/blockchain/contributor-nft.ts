/**
 * Contributor NFT Permission System
 * 
 * NFT-based contributor permissions replacing database flags.
 * Contributor roles are determined by NFT ownership and metadata.
 */

import { getContract, readContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { client as thirdwebClient } from "@/thirdweb-client";
import type { Address } from "thirdweb/wallets";

export type ContributorType = 'appointed' | 'earned' | 'invited' | null;

/**
 * Check if user is a contributor via NFT ownership
 * 
 * @param address - User's wallet address
 * @returns True if user owns a contributor NFT
 */
export async function isContributor(address: string): Promise<boolean> {
  try {
    const nftContractAddress = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS;
    
    // If no NFT contract is configured, fall back to false
    if (!nftContractAddress) {
      console.warn("NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS is not set");
      return false;
    }

    const contract = getContract({
      client: thirdwebClient,
      chain: base,
      address: nftContractAddress as Address,
    });

    // Check ERC721 balance
    const balance = await readContract({
      contract,
      method: "function balanceOf(address owner) view returns (uint256)",
      params: [address as Address],
    });

    return Number(balance) > 0;
  } catch (error) {
    console.error("Error checking contributor NFT:", error);
    // Fail-open: if we can't check, assume not a contributor
    return false;
  }
}

/**
 * Get contributor type from NFT metadata
 * 
 * This function attempts to read the contributor role from NFT metadata.
 * In a production setup, this would query token metadata and look for
 * role attributes. For now, it provides a basic implementation.
 * 
 * @param address - User's wallet address
 * @returns Contributor type or null if not a contributor
 */
export async function getContributorType(address: string): Promise<ContributorType> {
  try {
    const nftContractAddress = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS;
    
    if (!nftContractAddress) {
      return null;
    }

    const contract = getContract({
      client: thirdwebClient,
      chain: base,
      address: nftContractAddress as Address,
    });

    // First check if user has any NFTs
    const balance = await readContract({
      contract,
      method: "function balanceOf(address owner) view returns (uint256)",
      params: [address as Address],
    });

    if (Number(balance) === 0) {
      return null;
    }

    // TODO: In a full implementation, we would:
    // 1. Get the token ID(s) owned by the user
    // 2. Fetch the token metadata (tokenURI)
    // 3. Parse the metadata JSON to find the 'Role' attribute
    // 4. Return the role value
    
    // For now, return a default type if they own the NFT
    // This can be enhanced when the actual NFT metadata structure is defined
    return 'invited';
    
  } catch (error) {
    console.error("Error getting contributor type:", error);
    return null;
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
