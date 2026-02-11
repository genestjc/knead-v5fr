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
 * ✅ UPDATED: Uses contract's isParticipant function directly
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
  } catch (error: any) {
    const errorMsg = error.message?.toLowerCase() || '';
    
    // If already registered, that's actually fine!
    if (errorMsg.includes('already registered')) {
      console.log('ℹ️ Participant already registered:', address);
      return { transactionHash: 'already-registered' };
    }
    
    console.error('Error registering participant:', error);
    throw new Error(
      `Failed to register participant: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
