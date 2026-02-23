import { getContract, readContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { client as thirdwebClient } from "@/thirdweb-client";

export type ContributorType = 'appointed' | 'earned' | 'invited' | null;

/**
 * Check if user is a contributor via NFT ownership
 * 
 * @param address - User's wallet address
 * @returns True if user owns a contributor NFT (Token ID 1, 2, or 3)
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
      address: nftContractAddress,
    });

    // ✅ FIXED: Check ERC1155 balance for token IDs 1, 2, 3
    const tokenIds = [1, 2, 3]; // Appointed, Invited, Earned
    
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
    // Fail-open: if we can't check, assume not a contributor
    return false;
  }
}

/**
 * Get the contributor token ID owned by a user
 * 
 * Checks which contributor NFT token ID (1, 2, or 3) the user owns.
 * If user owns multiple, returns the first one found (in order: 1, 2, 3).
 * 
 * @param address - User's wallet address
 * @returns Token ID (1, 2, or 3) or null if not a contributor
 */
export async function getContributorTypeId(address: string): Promise<number | null> {
  try {
    const nftContractAddress = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS;
    
    if (!nftContractAddress) {
      return null;
    }

    const contract = getContract({
      client: thirdwebClient,
      chain: base,
      address: nftContractAddress,
    });

    const tokenIds = [1, 2, 3]; // Appointed, Invited, Earned
    
    for (const tokenId of tokenIds) {
      const balance = await readContract({
        contract,
        method: "function balanceOf(address account, uint256 id) view returns (uint256)",
        params: [address, BigInt(tokenId)],
      });
      
      if (Number(balance) > 0) {
        return tokenId;
      }
    }

    return null;
  } catch (error) {
    console.error("Error getting contributor type ID:", error);
    return null;
  }
}

/**
 * Get contributor type from NFT token ID ownership
 * 
 * Checks which contributor NFT token ID the user owns and returns the corresponding type.
 * 
 * @param address - User's wallet address
 * @returns Contributor type or null if not a contributor
 */
export async function getContributorType(address: string): Promise<ContributorType> {
  try {
    const tokenId = await getContributorTypeId(address);
    
    if (!tokenId) {
      return null;
    }

    switch (tokenId) {
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
 * Get contributor multiplier based on token ID
 * 
 * Different contributor types have different reward multipliers:
 * - Token ID 1 (Appointed): 0.8x multiplier
 * - Token ID 2 (Invited): 1.0x multiplier
 * - Token ID 3 (Earned): 1.5x multiplier
 * 
 * @param tokenId - Contributor token ID (1, 2, or 3)
 * @returns Multiplier value
 */
export function getContributorMultiplier(tokenId: number | null): number {
  switch (tokenId) {
    case 1:
      return 0.8; // Appointed
    case 2:
      return 1.0; // Invited
    case 3:
      return 1.5; // Earned
    default:
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

/**
 * Mint a contributor NFT to a recipient
 * 
 * @param recipientAddress - Address to receive the NFT
 * @param role - 'appointed', 'invited', or 'earned'
 * @param adminAddress - Admin authorizing the mint (for logging)
 * @returns Transaction hash and token ID
 */
export async function mintContributorNFT(
  recipientAddress: string,
  role: 'appointed' | 'invited' | 'earned',
  adminAddress: string
): Promise<{ transactionHash: string; tokenId: number }> {
  try {
    const nftContractAddress = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS;
    
    if (!nftContractAddress) {
      throw new Error('NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS not set');
    }

    // Map role to token ID
    const tokenIdMap = {
      'appointed': 1,
      'invited': 2,
      'earned': 3,
    };
    
    const tokenId = tokenIdMap[role];
    
    console.log('🎨 Minting contributor NFT:', {
      recipient: recipientAddress,
      role,
      tokenId,
      admin: adminAddress,
    });

    // Import server wallet
    const { serverWallet } = await import('@/thirdweb-server-wallet');
    const { createThirdwebClient, prepareContractCall, Engine } = await import('thirdweb');
    
    const client = createThirdwebClient({
      secretKey: process.env.THIRDWEB_SECRET_KEY!,
    });
    
    const contract = getContract({
      client,
      address: nftContractAddress,
      chain: base,
    });
    
    // Call adminMintContributor(address to, uint256 tokenId)
    const transaction = prepareContractCall({
      contract,
      method: 'function adminMintContributor(address to, uint256 tokenId)',
      params: [recipientAddress, BigInt(tokenId)],
    });
    
    // ✅ Correct: enqueueTransaction reads chainId from transaction.chain automatically
    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
    });

    // Diagnostic: check Engine queue status immediately after enqueue
    try {
      const status = await Engine.getTransactionStatus({
        client,
        transactionId,
      });
      console.log('🔍 Engine transaction status after enqueue:', JSON.stringify(status));
    } catch (statusErr) {
      console.warn('⚠️ Could not fetch transaction status:', statusErr);
    }
    
    const { transactionHash } = await Engine.waitForTransactionHash({
      client,
      transactionId,
    });
    
    console.log('✅ Contributor NFT mint queued:', {
      tokenId,
      txHash: transactionHash,
    });
    
    return {
      transactionHash,
      tokenId,
    };
  } catch (error: any) {
    console.error('❌ Error minting contributor NFT:', error);
    throw new Error(
      `Failed to mint contributor NFT: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
