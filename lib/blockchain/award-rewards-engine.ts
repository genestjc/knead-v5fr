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

/**
 * Award $TOWNS tokens via Engine wallet (no user signature required)
 * 
 * This function uses the Engine wallet to award tokens on behalf of admins.
 * The Engine wallet must have ADMIN_ROLE and ORACLE_ROLE on the rewards contract.
 * 
 * @param participantAddress - Recipient's wallet address
 * @param amount - Amount in $TOWNS tokens (not wei)
 * @param actionType - Type of action (e.g., "message_like", "admin_bonus")
 * @param eventId - Optional event ID for event-specific bonuses
 * @returns Transaction hash
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
export async function awardTownsViaEngine(
  participantAddress: string,
  amount: number,
  actionType: string = 'message_like',
  eventId?: number
): Promise<{ transactionHash: string }> {
  try {
    const rewardsContract = getRewardsContract();
    
    // Convert amount to wei (18 decimals)
    const amountInWei = BigInt(Math.floor(amount * 1e18));
    
    // ✅ Use different function based on whether eventId is provided
    const transaction = eventId !== undefined
      ? // For event bonuses: use awardEventBonus (ORACLE_ROLE)
        prepareContractCall({
          contract: rewardsContract,
          method: 'function awardEventBonus(uint256 _eventId, address _participant, uint256 _bonusAmount, string _bonusType)',
          params: [BigInt(eventId), participantAddress, amountInWei, actionType],
        })
      : // For general admin bonuses: use adminAwardTowns (ADMIN_ROLE) - NEW!
        prepareContractCall({
          contract: rewardsContract,
          method: 'function adminAwardTowns(address _participant, uint256 _amount, string _bonusType)',
          params: [participantAddress, amountInWei, actionType],
        });
    
    const receipt = await sendEngineTransaction({
      transaction,
      account: serverWallet,
    });
    
    console.log('✅ Tokens awarded via Engine:', {
      recipient: participantAddress,
      amount,
      actionType,
      eventId: eventId !== undefined ? eventId : 'general',
      txHash: receipt.transactionHash,
      method: eventId !== undefined ? 'awardEventBonus' : 'adminAwardTowns',
    });
    
    return {
      transactionHash: receipt.transactionHash,
    };
  } catch (error) {
    console.error('Error awarding tokens via Engine:', error);
    throw new Error(
      `Failed to award tokens: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get the contract's $TOWNS balance
 * 
 * @returns Contract balance in $TOWNS tokens
 */
export async function getContractBalance(): Promise<number> {
  try {
    const rewardsContract = getRewardsContract();
    
    const balance = await readContract({
      contract: rewardsContract,
      method: 'function getContractBalance() view returns (uint256)',
      params: [],
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
