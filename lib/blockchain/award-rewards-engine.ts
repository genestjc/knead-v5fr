/**
 * Award Rewards Engine
 * 
 * Engine wallet functions for awarding tokens without user signatures.
 * Uses ThirdWeb Engine to execute transactions on behalf of users.
 */

import { createThirdwebClient, getContract, prepareContractCall, readContract } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { sendTransaction as sendEngineTransaction } from 'thirdweb/transaction';
import { serverWallet } from '@/thirdweb-server-wallet';
import { keccak256, toHex } from 'viem';

const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY!,
});

/**
 * Get the rewards contract instance
 */
function getRewardsContract() {
  const address = process.env.NEXT_PUBLIC_REWARDS_CONTRACT_ADDRESS;
  
  if (!address) {
    throw new Error(
      'NEXT_PUBLIC_REWARDS_CONTRACT_ADDRESS not set. This contract address is required for automated rewards.'
    );
  }
  
  return getContract({
    client,
    address,
    chain: base,
  });
}

/**
 * Convert a Towns Protocol message ID (string) to bytes32 for smart contract use.
 * If the messageId is already a 32-byte hex string, use it directly.
 * Otherwise, hash it with keccak256 to produce a stable bytes32 value.
 */
function messageIdToBytes32(messageId: string): `0x${string}` {
  if (/^0x[0-9a-fA-F]{64}$/.test(messageId)) {
    return messageId as `0x${string}`;
  }
  return keccak256(toHex(messageId));
}

/**
 * Get the Engine wallet's available pool balance
 */
export async function getContributorPoolBalance(): Promise<number> {
  try {
    const engineWalletAddress = process.env.SERVER_WALLET_ADDRESS || process.env.ENGINE_SERVER_WALLET_ADDRESS;
    
    if (!engineWalletAddress) {
      throw new Error('SERVER_WALLET_ADDRESS not set in environment variables');
    }
    
    // Get the Engine wallet's participant stats to find claimable amount
    const stats = await getParticipantStats(engineWalletAddress);
    
    return stats.claimable;
  } catch (error) {
    console.error('Error fetching contributor pool balance:', error);
    throw new Error(
      `Failed to fetch pool balance: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Award $TOWNS tokens via Engine wallet using awardTip (80/20 split)
 * 
 * This function uses the Engine wallet to tip a participant on behalf of a contributor.
 * The Engine wallet must have ADMIN_ROLE on the rewards contract.
 * NOTE: messageId is a Towns Protocol event ID (message identifier), not a calendar event.
 * 
 * @param contributorAddress - Contributor's wallet address (tipper)
 * @param participantAddress - Recipient's wallet address
 * @param amount - Amount in $TOWNS tokens (not wei)
 * @param actionType - Type of action (e.g., "message_like")
 * @param messageId - Towns Protocol message/event ID for the tipped message
 * @returns Transaction hash
 */
export async function awardTownsViaEngine(
  contributorAddress: string,
  participantAddress: string,
  amount: number,
  actionType: string = 'message_like',
  messageId: string = ''
): Promise<{ transactionHash: string }> {
  try {
    const rewardsContract = getRewardsContract();
    
    // Convert amount to wei (18 decimals)
    const amountInWei = BigInt(Math.floor(amount * 1e18));

    // For regular tipping (used when contributor tips a message)
    // NOTE: messageId here is a Towns Protocol eventId (message identifier), not a calendar event
    const messageIdBytes32 = messageIdToBytes32(messageId);
    const transaction = prepareContractCall({
      contract: rewardsContract,
      method: 'function awardTip(address _contributor, address _participant, uint256 _tipAmount, bytes32 _messageId, string _actionType)',
      params: [
        contributorAddress,
        participantAddress,
        amountInWei,
        messageIdBytes32,
        actionType,
      ],
    });
    
    const receipt = await sendEngineTransaction({
      transaction,
      account: serverWallet,
    });
    
    console.log('✅ Tip awarded via Engine:', {
      contributor: contributorAddress,
      recipient: participantAddress,
      amount,
      actionType,
      messageId,
      txHash: receipt.transactionHash,
    });
    
    return {
      transactionHash: receipt.transactionHash,
    };
  } catch (error) {
    console.error('Error awarding tip via Engine:', error);
    throw new Error(
      `Failed to award tip: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Award $TOWNS bonus via Engine wallet using adminAwardBonus (100% to participant)
 * 
 * This function uses the Engine wallet to award admin bonuses.
 * The Engine wallet must have ADMIN_ROLE on the rewards contract.
 * 
 * @param participantAddress - Recipient's wallet address
 * @param amount - Amount in $TOWNS tokens (not wei)
 * @param bonusType - Type of bonus (e.g., "admin_bonus", "event_attendance")
 * @returns Transaction hash
 */
export async function adminAwardBonus(
  participantAddress: string,
  amount: number,
  bonusType: string = 'admin_bonus'
): Promise<{ transactionHash: string }> {
  try {
    const rewardsContract = getRewardsContract();
    
    // Convert amount to wei (18 decimals)
    const amountInWei = BigInt(Math.floor(amount * 1e18));

    // For admin bonus awards (special rewards, not message tips)
    const transaction = prepareContractCall({
      contract: rewardsContract,
      method: 'function adminAwardBonus(address _participant, uint256 _amount, string _bonusType)',
      params: [participantAddress, amountInWei, bonusType],
    });
    
    const receipt = await sendEngineTransaction({
      transaction,
      account: serverWallet,
    });
    
    console.log('✅ Admin bonus awarded via Engine:', {
      recipient: participantAddress,
      amount,
      bonusType,
      txHash: receipt.transactionHash,
    });
    
    return {
      transactionHash: receipt.transactionHash,
    };
  } catch (error) {
    console.error('Error awarding admin bonus via Engine:', error);
    throw new Error(
      `Failed to award bonus: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get the contract's $TOWNS balance
 * 
 * Queries the $TOWNS token contract to get the actual ERC20 balance
 * held by the rewards contract address.
 * 
 * @returns Contract balance in $TOWNS tokens
 */
export async function getContractBalance(): Promise<number> {
  try {
    const rewardsContractAddress = process.env.NEXT_PUBLIC_REWARDS_CONTRACT_ADDRESS;
    const townsContractAddress = process.env.NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS;
    
    if (!rewardsContractAddress || !townsContractAddress) {
      throw new Error('Contract addresses not configured');
    }

    // Query the $TOWNS token contract for the rewards contract's balance
    const townsContract = getContract({
      client,
      address: townsContractAddress,
      chain: base,
    });

    const balance = await readContract({
      contract: townsContract,
      method: 'function balanceOf(address account) view returns (uint256)',
      params: [rewardsContractAddress],
    });
    
    // Convert from wei to $TOWNS
    return Number(balance) / 1e18;
  } catch (error) {
    console.error('Error fetching contract balance:', error);
    throw new Error(
      `Failed to fetch contract balance: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get participant's stats from the rewards contract
 * 
 * @param participantAddress - Participant's wallet address
 * @returns Participant statistics
 */
export async function getParticipantStats(participantAddress: string): Promise<{
  totalTownsEarned: number;
  townsClaimed: number;
  tier: number;
  hasGraduated: boolean;
  claimable: number;
  // Legacy aliases for backward compatibility
  totalEarned: number;
  claimed: number;
  graduated: boolean;
  availableToClaim: number;
}> {
  try {
    const rewardsContract = getRewardsContract();
    
    const stats = await readContract({
      contract: rewardsContract,
      method: 'function getParticipantStats(address _participant) view returns (uint256 totalTownsEarned, uint256 townsClaimed, uint8 tier, bool hasGraduated, uint256 claimable)',
      params: [participantAddress],
    });
    
    const totalTownsEarned = Number(stats[0]) / 1e18;
    const townsClaimed = Number(stats[1]) / 1e18;
    const tier = Number(stats[2]);
    const hasGraduated = Boolean(stats[3]);
    const claimable = Number(stats[4]) / 1e18;

    return {
      totalTownsEarned,
      townsClaimed,
      tier,
      hasGraduated,
      claimable,
      // Legacy aliases
      totalEarned: totalTownsEarned,
      claimed: townsClaimed,
      graduated: hasGraduated,
      availableToClaim: claimable,
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
 * 
 * @param contributorAddress - Contributor's wallet address
 * @returns Contributor statistics
 */
export async function getContributorStats(contributorAddress: string): Promise<{
  lockedAllowance: number;
  cashbackEarnings: number;
  totalTipped: number;
}> {
  try {
    const rewardsContract = getRewardsContract();
    
    const stats = await readContract({
      contract: rewardsContract,
      method: 'function getContributorStats(address _contributor) view returns (uint256 lockedAllowance, uint256 cashbackEarnings, uint256 totalTipped)',
      params: [contributorAddress],
    });
    
    return {
      lockedAllowance: Number(stats[0]) / 1e18,
      cashbackEarnings: Number(stats[1]) / 1e18,
      totalTipped: Number(stats[2]) / 1e18,
    };
  } catch (error) {
    console.error('Error fetching contributor stats:', error);
    throw new Error(
      `Failed to fetch contributor stats: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Check if address is a registered participant
 * 
 * @param address - Address to check
 * @returns True if participant
 */
export async function isParticipant(address: string): Promise<boolean> {
  try {
    const rewardsContract = getRewardsContract();
    
    return await readContract({
      contract: rewardsContract,
      method: 'function isParticipant(address _address) view returns (bool)',
      params: [address],
    });
  } catch (error) {
    console.error('Error checking participant status:', error);
    return false;
  }
}
