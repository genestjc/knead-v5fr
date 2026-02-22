/**
 * Award Rewards Engine
 * 
 * Engine wallet functions for awarding tokens without user signatures.
 * Uses ThirdWeb Engine to execute transactions on behalf of users.
 * 
 * ⚠️ SERVER-ONLY: This file uses secret keys and must never be imported in client components!
 */

import { createThirdwebClient, getContract, prepareContractCall, readContract } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { serverWallet } from '@/thirdweb-server-wallet';
import { ethers } from 'ethers';

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
 * Award $TOWNS tokens via contributor tipping (80/20 split)
 * 
 * This function uses the Engine wallet to execute contributor tips.
 * The contributor receives 20% cashback, participant receives 80%.
 * The Engine wallet must have ADMIN_ROLE on the rewards contract.
 * 
 * @param contributorAddress - Contributor's wallet address
 * @param participantAddress - Recipient's wallet address
 * @param amount - Amount in $TOWNS tokens (not wei)
 * @param messageId - Towns Protocol message ID (eventId)
 * @param actionType - Type of action (e.g., "message_like")
 * @returns Transaction hash
 */
export async function awardTownsViaEngine(
  contributorAddress: string,
  participantAddress: string,
  amount: number,
  messageId: string,
  actionType: string = 'message_like'
): Promise<{ transactionHash: string }> {
  try {
    const rewardsContract = getRewardsContract();
    
    // Convert amount to wei (18 decimals)
    const amountInWei = BigInt(Math.floor(amount * 1e18));
    
    // ✅ FIXED: Convert Towns Protocol messageId to bytes32 using keccak256
    // Towns eventIds can be long strings, so we hash them instead of truncating
    const messageIdBytes32 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(messageId));
    
    // Use awardTip for contributor tipping (80/20 split)
    const transaction = prepareContractCall({
      contract: rewardsContract,
      method: 'function awardTip(address _contributor, address _participant, uint256 _tipAmount, bytes32 _messageId, string _actionType)',
      params: [contributorAddress, participantAddress, amountInWei, messageIdBytes32, actionType],
    });
    
    const { transactionHash } = await serverWallet.sendTransaction(transaction, {
      chain: base,
    });
    
    console.log('✅ Tip awarded via Engine:', {
      contributor: contributorAddress,
      recipient: participantAddress,
      amount,
      messageId,
      messageIdHash: messageIdBytes32,
      actionType,
      txHash: transactionHash,
    });
    
    return {
      transactionHash,
    };
  } catch (error) {
    console.error('Error awarding tip via Engine:', error);
    throw new Error(
      `Failed to award tip: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Award admin bonus (100% to participant, bypasses allowances)
 * 
 * This function uses the Engine wallet to award admin bonuses.
 * The participant receives 100% of the amount.
 * The Engine wallet must have ADMIN_ROLE on the rewards contract.
 * 
 * @param participantAddress - Recipient's wallet address
 * @param amount - Amount in $TOWNS tokens (not wei)
 * @param bonusType - Type of bonus (e.g., "outstanding_contribution")
 * @returns Transaction hash
 */
export async function awardAdminBonus(
  participantAddress: string,
  amount: number,
  bonusType: string
): Promise<{ transactionHash: string }> {
  try {
    const rewardsContract = getRewardsContract();
    
    // Convert amount to wei (18 decimals)
    const amountInWei = BigInt(Math.floor(amount * 1e18));
    
    // Use adminAwardBonus for special admin rewards (100% payout)
    const transaction = prepareContractCall({
      contract: rewardsContract,
      method: 'function adminAwardBonus(address _participant, uint256 _amount, string _bonusType)',
      params: [participantAddress, amountInWei, bonusType],
    });
    
    const { transactionHash } = await serverWallet.sendTransaction(transaction, {
      chain: base,
    });
    
    console.log('✅ Admin bonus awarded via Engine:', {
      recipient: participantAddress,
      amount,
      bonusType,
      txHash: transactionHash,
    });
    
    return {
      transactionHash,
    };
  } catch (error) {
    console.error('Error awarding admin bonus via Engine:', error);
    throw new Error(
      `Failed to award admin bonus: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get contributor pool balance (Engine wallet's claimable balance)
 */
export async function getContributorPoolBalance(): Promise<number> {
  try {
    const engineWalletAddress = process.env.SERVER_WALLET_ADDRESS || process.env.ENGINE_SERVER_WALLET_ADDRESS;
    
    if (!engineWalletAddress) {
      throw new Error('SERVER_WALLET_ADDRESS not set in environment variables');
    }
    
    // Read participant stats for engine wallet (server-side only)
    const rewardsContract = getRewardsContract();
    
    const stats = await readContract({
      contract: rewardsContract,
      method: 'function getParticipantStats(address _participant) view returns (uint256 totalEarned, uint256 claimed, uint8 tier, uint256 cohort, bool graduated, uint256 claimable)',
      params: [engineWalletAddress],
    });
    
    return Number(stats[5]) / 1e18; // stats[5] is claimable
  } catch (error) {
    console.error('Error fetching contributor pool balance:', error);
    throw new Error(
      `Failed to fetch pool balance: ${error instanceof Error ? error.message : String(error)}`
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
    
    return Number(balance) / 1e18;
  } catch (error) {
    console.error('Error fetching contract balance:', error);
    throw new Error(
      `Failed to fetch contract balance: ${error instanceof Error ? error.message : String(error)}`
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
