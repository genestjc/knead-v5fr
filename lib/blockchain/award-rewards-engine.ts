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
 * This function uses the Engine wallet to award tokens on behalf of contributors.
 * The Engine wallet must have CONTRIBUTOR_ROLE on the rewards contract.
 * 
 * @param participantAddress - Recipient's wallet address
 * @param amount - Amount in $TOWNS tokens (not wei)
 * @param actionType - Type of action (e.g., "message_like")
 * @returns Transaction hash
 */
export async function awardTownsViaEngine(
  participantAddress: string,
  amount: number,
  actionType: string = 'message_like'
): Promise<{ transactionHash: string }> {
  try {
    const rewardsContract = getRewardsContract();
    
    // Convert amount to wei (18 decimals)
    const amountInWei = BigInt(Math.floor(amount * 1e18));
    
    // Prepare the awardTowns transaction
    const transaction = prepareContractCall({
      contract: rewardsContract,
      method: 'function awardTowns(address recipient, uint256 amount, string memory actionType)',
      params: [participantAddress, amountInWei, actionType],
    });
    
    // Send transaction from Engine wallet
    const receipt = await sendEngineTransaction({
      transaction,
      account: serverWallet,
    });
    
    console.log('✅ Tokens awarded via Engine:', {
      recipient: participantAddress,
      amount,
      actionType,
      txHash: receipt.transactionHash,
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
 * Get the current contributor pool balance
 * 
 * This is the 25% of earnings accumulated by the Engine wallet
 * that will be distributed weekly to all contributors.
 * 
 * @returns Pool balance in $TOWNS tokens
 */
export async function getContributorPoolBalance(): Promise<number> {
  try {
    const rewardsContract = getRewardsContract();
    const engineWalletAddress = process.env.ENGINE_SERVER_WALLET_ADDRESS;
    
    if (!engineWalletAddress) {
      throw new Error('ENGINE_SERVER_WALLET_ADDRESS not set');
    }
    
    // Read the accumulated earnings from the contract
    const stats = await readContract({
      contract: rewardsContract,
      method: 'function getParticipantStats(address) view returns (uint256 totalEarned, uint256 totalClaimed, uint256 availableToClaim, uint256 lastClaimTime)',
      params: [engineWalletAddress],
    });
    
    // stats[2] is availableToClaim in wei
    const poolBalanceWei = stats[2];
    
    // Convert from wei to $TOWNS
    return Number(poolBalanceWei) / 1e18;
  } catch (error) {
    console.error('Error fetching contributor pool balance:', error);
    
    // If the contract doesn't have getParticipantStats, try alternative method
    // Fall back to checking $TOWNS token balance of engine wallet
    try {
      const townsContractAddress = process.env.NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS;
      const engineWalletAddress = process.env.ENGINE_SERVER_WALLET_ADDRESS;
      
      if (!townsContractAddress || !engineWalletAddress) {
        throw new Error('Missing contract addresses');
      }
      
      const townsContract = getContract({
        client,
        address: townsContractAddress,
        chain: base,
      });
      
      const balance = await readContract({
        contract: townsContract,
        method: 'function balanceOf(address) view returns (uint256)',
        params: [engineWalletAddress],
      });
      
      return Number(balance) / 1e18;
    } catch (fallbackError) {
      console.error('Fallback balance check also failed:', fallbackError);
      throw new Error(
        `Failed to fetch pool balance: ${error instanceof Error ? error.message : String(error)}`
      );
    }
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
  totalClaimed: number;
  availableToClaim: number;
  lastClaimTime: number;
}> {
  try {
    const rewardsContract = getRewardsContract();
    
    const stats = await readContract({
      contract: rewardsContract,
      method: 'function getParticipantStats(address) view returns (uint256 totalEarned, uint256 totalClaimed, uint256 availableToClaim, uint256 lastClaimTime)',
      params: [participantAddress],
    });
    
    return {
      totalEarned: Number(stats[0]) / 1e18,
      totalClaimed: Number(stats[1]) / 1e18,
      availableToClaim: Number(stats[2]) / 1e18,
      lastClaimTime: Number(stats[3]),
    };
  } catch (error) {
    console.error('Error fetching participant stats:', error);
    throw new Error(
      `Failed to fetch participant stats: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
