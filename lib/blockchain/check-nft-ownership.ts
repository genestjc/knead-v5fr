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
import { base } from "thirdweb/chains";
import { client as thirdwebClient } from "@/thirdweb-client";

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
 * Check if user owns Knead Monthly subscription (Token ID 1)
 */
export async function hasKneadMonthly(address: string): Promise<boolean> {
  try {
    const nftContractAddress = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS;
    
    // 🔍 DEBUG LOGGING
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔍 hasKneadMonthly() called");
    console.log("  Wallet:", address);
    console.log("  Contract from env:", nftContractAddress);
    console.log("  Expected:", "0xfd678ed8a0ed853d5399da9585d46aea44cbce85");
    console.log("  Match?", nftContractAddress?.toLowerCase() === "0xfd678ed8a0ed853d5399da9585d46aea44cbce85");
    
    if (!nftContractAddress) {
      console.warn("❌ NEXT_PUBLIC_NFT_CONTRACT_ADDRESS is not set");
      return false;
    }

    const contract = getContract({
      client: thirdwebClient,
      chain: base,
      address: nftContractAddress,
    });

    console.log("  Checking Token ID: 1");

    const balance = await readContract({
      contract,
      method: "function balanceOf(address account, uint256 id) view returns (uint256)",
      params: [address, BigInt(1)],
    });

    console.log("  Balance:", balance.toString());
    console.log("  Has NFT?", Number(balance) > 0 ? "✅ YES" : "❌ NO");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return Number(balance) > 0;
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
      chain: base,
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
 * Get user's role based on NFT ownership
 * 
 * Priority: Contributor > Participant (Monthly OR Event Pass) > Freemium
 */
export async function getUserRole(address: string): Promise<UserRoleInfo> {
  try {
    // Check all NFT types in parallel
    const [hasMonthly, contributorCheck, eventPassCheck] = await Promise.all([
      hasKneadMonthly(address),
      isContributor(address),
      hasEventPass(address),
    ]);

    // Determine role based on priority
    let role: UserRole = 'freemium';
    
    if (contributorCheck.isContributor) {
      role = 'contributor';
    } else if (hasMonthly || eventPassCheck.hasPass) {
      // ✅ Event Pass grants Participant role
      role = 'participant';
    }

    return {
      role,
      hasKneadMonthly: hasMonthly,
      hasContributor: contributorCheck.isContributor,
      hasEventPass: eventPassCheck.hasPass,
      eventId: eventPassCheck.eventId,
      contributorTokenId: contributorCheck.tokenId,
    };
  } catch (error) {
    console.error("Error getting user role:", error);
    
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
