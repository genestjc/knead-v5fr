import { createThirdwebClient, getContract, prepareContractCall, readContract, Engine } from 'thirdweb';
import { base } from 'thirdweb/chains';
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
    
    // Use the contract's built-in isParticipant function
    const isRegistered = await readContract({
      contract,
      method: 'function isParticipant(address) view returns (bool)',
      params: [address],
    });
    
    return isRegistered;
    
  } catch (error: any) {
    console.error('Error checking registration status:', error);
    
    // If there's an error, assume not registered (safer to try registration)
    return false;
  }
}

/**
 * Register a participant in the rewards contract
 * 
 * @param address - Participant's wallet address
 */
export async function registerParticipant(address: string): Promise<{ transactionHash: string }> {
  try {
    const contract = getRewardsContract();
    
    // ✅ UPDATED: KneadRewardsV5 takes address and cohort parameters
    const transaction = prepareContractCall({
      contract,
      method: 'function registerParticipant(address _participant, uint256 _cohort)',
      params: [address, BigInt(1)],
    });
    
    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
    });

    const { transactionHash } = await Engine.waitForTransactionHash({
      client,
      transactionId,
    });
    
    console.log('✅ Participant registered:', {
      address,
      txHash: transactionHash,
    });
    
    return {
      transactionHash,
    };
  } catch (error: any) {
    const errorMsg = error.message?.toLowerCase() || '';
    
    if (errorMsg.includes('already registered')) {
      console.log('ℹ️ Participant already registered:', address);
      return { transactionHash: 'already-registered' };
    }
    
    // Log more details for debugging
    console.error('❌ Error registering participant:', {
      address,
      error: error.message,
      fullError: error,
    });
    
    throw new Error(
      `Failed to register participant: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
