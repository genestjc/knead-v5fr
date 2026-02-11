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
 * ✅ UPDATED: Now reads participants mapping directly for accurate check
 */
export async function isParticipantRegistered(address: string): Promise<boolean> {
  try {
    const contract = getRewardsContract();
    
    // Read participant struct directly from contract
    const participant = await readContract({
      contract,
      method: 'function participants(address) view returns (address walletAddress, uint256 totalTownsEarned, bool hasGraduated, bool isRegistered, uint256 tier, uint256 registrationTime)',
      params: [address],
    });
    
    // participant is returned as an array
    // Index 3 = isRegistered boolean
    return participant[3] as boolean;
    
  } catch (error: any) {
    console.error('Error checking registration status:', error);
    
    // If participant doesn't exist in mapping, they're not registered
    const errorMsg = error.message?.toLowerCase() || '';
    if (errorMsg.includes('not found') || 
        errorMsg.includes('does not exist') || 
        errorMsg.includes('execution reverted')) {
      return false;
    }
    
    // For other errors (network, RPC, etc.), throw to surface the issue
    throw new Error(`Failed to check registration: ${error.message || String(error)}`);
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
