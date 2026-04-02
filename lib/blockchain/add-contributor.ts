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
 * @param weeklyBudget - Weekly budget in USDC (e.g., 100 for 100 USDC)
 */
export async function addContributorToRewards(
  contributorAddress: string,
  contributorType: 0 | 1 | 2,
  weeklyBudget: number
): Promise<{ transactionId: string }> {
  try {
    const contract = getRewardsContract();
    
    // Convert USDC to smallest unit (6 decimals)
    const weeklyBudgetWei = BigInt(Math.floor(weeklyBudget * 1e6));
    
    const transaction = prepareContractCall({
      contract,
      method: 'function addContributor(address _contributor, uint8 _type, uint256 _weeklyBudgetTowns)',
      params: [contributorAddress, contributorType, weeklyBudgetWei],
    });
    
    // ✅ Correct: enqueueTransaction reads chainId from transaction.chain automatically
    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
    });

    console.log('✅ Contributor add to rewards enqueued:', {
      address: contributorAddress,
      type: contributorType,
      weeklyBudget,
      transactionId,
    });
    
    return {
      transactionId,
    };
  } catch (error: any) {
    console.error('Error adding contributor to rewards:', error);
    throw new Error(
      `Failed to add contributor to rewards: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
