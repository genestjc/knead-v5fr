/**
 * Contract Read Operations (Client-Safe)
 *
 * Read-only functions that can be used in client components.
 * Uses public client (no secret key required).
 */

'use client';

import { createThirdwebClient, getContract, readContract } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { keccak256, toHex } from 'viem';

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
      totalEarned: Number(stats[0]) / 1e6,
      claimed: Number(stats[1]) / 1e6,
      tier: Number(stats[2]),
      cohort: Number(stats[3]),
      graduated: Boolean(stats[4]),
      claimable: Number(stats[5]) / 1e6,
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
      weeklyBudget: Number(stats[1]) / 1e6,
      lockedAllowance: Number(stats[2]) / 1e6,
      cashbackEarnings: Number(stats[3]) / 1e6,
      cashbackClaimed: Number(stats[4]) / 1e6,
      totalTipped: Number(stats[5]) / 1e6,
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
      graduationThreshold: Number(graduationThreshold) / 1e6,
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
 * Get total USDC earned for a specific message (on-chain)
 *
 * The write side (award-rewards-engine.ts) stores the messageId as
 * keccak256(toUtf8Bytes(messageId)), so the read side MUST apply the
 * same hash to look up the correct slot.
 *
 * The contract's getMessageEarnings requires BOTH _messageId AND _participant,
 * and returns (totalEarned, tipCount, timestamp). We return totalEarned.
 *
 * @param messageId          - Towns Protocol message ID (any string / hex)
 * @param participantAddress - Wallet address of the message sender (participant)
 * @returns Total earnings in USDC
 */
export async function getMessageEarnings(
  messageId: string,
  participantAddress: string
): Promise<number> {
  try {
    const rewardsContract = getRewardsContract();

    // ✅ Matches award-rewards-engine.ts: keccak256(toUtf8Bytes(messageId))
    const messageIdBytes32 = keccak256(toHex(messageId)) as `0x${string}`;

    const earnings = await readContract({
      contract: rewardsContract,
      method: 'function getMessageEarnings(bytes32 _messageId, address _participant) view returns (uint256 totalEarned, uint256 tipCount, uint256 timestamp)',
      params: [messageIdBytes32, participantAddress as `0x${string}`],
    });

    // earnings[0] is totalEarned
    return Number(earnings[0]) / 1e6;
  } catch (error) {
    console.error('Error fetching message earnings:', error);
    return 0;
  }
}
