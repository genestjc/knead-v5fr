import { createThirdwebClient, getContract, prepareContractCall, readContract } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { sendTransaction } from 'thirdweb/transaction';
import { serverWallet } from '@/thirdweb-server-wallet';

const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY!,
});

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
 * Check if a participant is registered in the rewards contract
 */
export async function isParticipantRegistered(address: string): Promise<boolean> {
  try {
    const contract = getRewardsContract();
    
    // Try to get participant stats - if they exist, they're registered
    await readContract({
      contract,
      method: 'function getParticipantStats(address) view returns (uint256 totalEarned, uint256 totalClaimed, uint256 availableToClaim, uint256 lastClaimTime)',
      params: [address],
    });
    
    // If we get stats back without error, they're registered
    return true;
  } catch {
    // If error, they're likely not registered
    return false;
  }
}

/**
 * Register a participant in the rewards contract
 * Must be called before awarding tokens to new users
 */
export async function registerParticipant(address: string): Promise<{ transactionHash: string }> {
  try {
    const contract = getRewardsContract();
    
    const transaction = prepareContractCall({
      contract,
      method: 'function registerParticipant(address _participant)',
      params: [address],
    });
    
    const receipt = await sendTransaction({
      transaction,
      account: serverWallet,
    });
    
    console.log('✅ Participant registered:', {
      address,
      txHash: receipt.transactionHash,
    });
    
    return {
      transactionHash: receipt.transactionHash,
    };
  } catch (error) {
    console.error('Error registering participant:', error);
    throw new Error(
      `Failed to register participant: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
