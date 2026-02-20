/**
 * Contract Read Operations (Client-Safe)
 * 
 * Read-only functions that can be used in client components.
 * Uses public client (no secret key required).
 */

'use client';

import { createThirdwebClient, getContract, readContract } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { keccak256, toUtf8Bytes } from 'ethers/lib/utils';

// ✅ Public client - safe for browser
const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

/**
 * Get the rewards contract instance
 */
function getRewardsContract() {
  const address = process.env.NEXT_PUBLIC_REWARDS_CONTRACT_ADDRESS;
  
  if (!address) {
    throw new Error('NEXT_PUBLIC_REWARDS_CONTRACT_ADDRESS not set');
  }
  
  return getContract({
    client,
    address,
    chain: base,
  });
}

/**
 * Get participant's stats from the rewards contract
 */
export async function getParticipantStats(participantAddress: string): Promise<{
  totalEarned: number;
  claimed: number;
  tier: number;
  cohort: number;
  graduated: boolean;
  claimable: number;
}> {
  try {
    const rewardsContract = getRewardsContract();
    
    const stats = await readContract({
      contract: rewardsContract,
      method: 'function getParticipantStats(address _participant) view returns (uint256 totalEarned, uint256 claimed, uint8 tier, uint256 cohort, bool graduated, uint256 claimable)',
      params: [participantAddress],
    });
    
    return {
      totalEarned: Number(stats[0]) / 1e18,
      claimed: Number(stats[1]) / 1e18,
      tier: Number(stats[2]),
      cohort: Number(stats[3]),
      graduated: Boolean(stats[4]),
      claimable: Number(stats[5]) / 1e18,
    };
  } catch (error) {
    console.error('Error fetching participant stats:', error);
    throw new Error(
      `Failed to fetch participant stats: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get contributor's stats from the rewards contract
 */
export async function getContributorStats(contributorAddress: string): Promise<{
  cType: number;
  weeklyBudget: number;
  lockedAllowance: number;
  cashbackEarnings: number;
  cashbackClaimed: number;
  totalTipped: number;
  daysUntilReset: number;
}> {
  try {
    const rewardsContract = getRewardsContract();
    
    const stats = await readContract({
      contract: rewardsContract,
      method: 'function getContributorStats(address _contributor) view returns (uint8 cType, uint256 weeklyBudget, uint256 lockedAllowance, uint256 cashbackEarnings, uint256 cashbackClaimed, uint256 totalTipped, uint256 daysUntilReset)',
      params: [contributorAddress],
    });
    
    return {
      cType: Number(stats[0]),
      weeklyBudget: Number(stats[1]) / 1e18,
      lockedAllowance: Number(stats[2]) / 1e18,
      cashbackEarnings: Number(stats[3]) / 1e18,
      cashbackClaimed: Number(stats[4]) / 1e18,
      totalTipped: Number(stats[5]) / 1e18,
      daysUntilReset: Number(stats[6]),
    };
  } catch (error) {
    console.error('Error fetching contributor stats:', error);
    throw new Error(
      `Failed to fetch contributor stats: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get contract constants (graduation threshold)
 */
export async function getContractConstants(): Promise<{
  graduationThreshold: number;
  weeklyAllowance: number;
}> {
  try {
    const rewardsContract = getRewardsContract();
    
    const graduationThreshold = await readContract({
      contract: rewardsContract,
      method: 'function graduationThreshold() view returns (uint256)',
      params: [],
    });
    
    return {
      graduationThreshold: Number(graduationThreshold) / 1e18,
      weeklyAllowance: 25, // Hardcoded since not in contract
    };
  } catch (error) {
    console.error('Error fetching contract constants:', error);
    throw new Error(
      `Failed to fetch contract constants: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get total $TOWNS earned for a specific message (on-chain)
 *
 * @param messageId - Towns Protocol message ID (string, will be hashed to bytes32)
 * @returns Total earnings in $TOWNS tokens
 */
export async function getMessageEarnings(messageId: string): Promise<number> {
  try {
    const rewardsContract = getRewardsContract();
    const messageIdBytes32 = keccak256(toUtf8Bytes(messageId));

    const earnings = await readContract({
      contract: rewardsContract,
      method: 'function getMessageEarnings(bytes32 _messageId) view returns (uint256)',
      params: [messageIdBytes32 as `0x${string}`],
    });

    return Number(earnings) / 1e18;
  } catch (error) {
    console.error('Error fetching message earnings:', error);
    return 0;
  }
}
