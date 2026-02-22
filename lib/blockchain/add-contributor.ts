import { createThirdwebClient, getContract, prepareContractCall } from 'thirdweb';
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
 * Add a contributor to the rewards contract
 * 
 * @param contributorAddress - Wallet address of the contributor
 * @param contributorType - 0=Appointed, 1=Invited, 2=Earned
 * @param weeklyBudget - Weekly budget in TOWNS (e.g., 100 for 100 TOWNS)
 */
export async function addContributorToRewards(
  contributorAddress: string,
  contributorType: 0 | 1 | 2,
  weeklyBudget: number
): Promise<{ transactionHash: string }> {
  try {
    const contract = getRewardsContract();
    
    // Convert TOWNS to wei (18 decimals)
    const weeklyBudgetWei = BigInt(Math.floor(weeklyBudget * 1e18));
    
    const transaction = prepareContractCall({
      contract,
      method: 'function addContributor(address _contributor, uint8 _type, uint256 _weeklyBudgetTowns)',
      params: [contributorAddress, contributorType, weeklyBudgetWei],
    });
    
    // ✅ Non-blocking: Engine queues the tx and returns immediately
    const { transactionHash } = await serverWallet.sendTransaction(transaction, {
      chain: base,
    });
    
    console.log('✅ Contributor add to rewards queued:', {
      address: contributorAddress,
      type: contributorType,
      weeklyBudget,
      txHash: transactionHash,
    });
    
    return {
      transactionHash,
    };
  } catch (error: any) {
    console.error('Error adding contributor to rewards:', error);
    throw new Error(
      `Failed to add contributor to rewards: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
