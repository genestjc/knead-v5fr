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
 * Award a tip from a contributor to a participant (80/20 split)
 *
 * @param contributorAddress - Contributor's wallet address (tipper)
 * @param participantAddress - Recipient's wallet address
 * @param amount - Amount in $TOWNS tokens (not wei)
 * @param messageId - Hex message ID (bytes32)
 * @param actionType - Type of action (e.g., "message_like")
 * @returns Transaction hash
 */
export async function awardTipViaEngine(
  contributorAddress: string,
  participantAddress: string,
  amount: number,
  messageId: string,
  actionType: string = 'message_like',
): Promise<{ transactionHash: string }> {
  try {
    const rewardsContract = getRewardsContract();

    const amountInWei = BigInt(Math.floor(amount * 1e18));
    const hexId = messageId.replace(/^0x/, '');
    const messageIdBytes = `0x${hexId.replace(/[^0-9a-fA-F]/g, '0').padStart(64, '0')}` as `0x${string}`;

    const transaction = prepareContractCall({
      contract: rewardsContract,
      method: 'function awardTip(address _contributor, address _participant, uint256 _tipAmount, bytes32 _messageId, string _actionType)',
      params: [contributorAddress, participantAddress, amountInWei, messageIdBytes, actionType],
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
      txHash: receipt.transactionHash,
    });

    return { transactionHash: receipt.transactionHash };
  } catch (error) {
    console.error('Error awarding tip via Engine:', error);
    throw new Error(
      `Failed to award tip: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Award an admin bonus to a participant (100% to participant)
 *
 * @param participantAddress - Recipient's wallet address
 * @param amount - Amount in $TOWNS tokens (not wei)
 * @param bonusType - Type of bonus (e.g., "great_contribution")
 * @returns Transaction hash
 */
export async function adminAwardBonusViaEngine(
  participantAddress: string,
  amount: number,
  bonusType: string,
): Promise<{ transactionHash: string }> {
  try {
    const rewardsContract = getRewardsContract();

    const amountInWei = BigInt(Math.floor(amount * 1e18));

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

    return { transactionHash: receipt.transactionHash };
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
  totalEarned: number;
  claimed: number;
  tier: number;
  cohort: number;
  graduated: boolean;
  claimable: number;
  availableToClaim: number;
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
      availableToClaim: Number(stats[5]) / 1e18, // Alias for backward compatibility
    };
  } catch (error) {
    console.error('Error fetching participant stats:', error);
    throw new Error(
      `Failed to fetch participant stats: ${error instanceof Error ? error.message : String(error)}`
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
