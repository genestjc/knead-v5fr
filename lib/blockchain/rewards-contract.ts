import { createThirdwebClient, getContract, prepareContractCall, readContract } from 'thirdweb';
import { base } from 'thirdweb/chains';

const client = createThirdwebClient({ 
  secretKey: process.env.THIRDWEB_SECRET_KEY!  
});

// 🆕 LAZY INITIALIZATION - only create contract when needed
function getRewardsContract() {
  const address = process.env.KNEAD_REWARDS_CONTRACT_ADDRESS;
  
  if (!address) {
    throw new Error(
      'KNEAD_REWARDS_CONTRACT_ADDRESS not set. Deploy KneadRewards. sol first, then add this environment variable.'
    );
  }
  
  return getContract({
    client,
    address,
    chain: base,
  });
}

/**
 * Award points to a participant (server-side, contributor wallet signs)
 */
export async function awardPointsOnChain(
  participantAddress: string,
  points: number,
  actionType: string
) {
  const rewardsContract = getRewardsContract(); // 🆕 Get contract here
  
  const transaction = prepareContractCall({
    contract: rewardsContract,
    method: 'function awardPoints(address,uint256,string)',
    params: [participantAddress, BigInt(points), actionType],
  });
  
  return await transaction.send();
}

/**
 * Get user's reward statistics
 */
export async function getUserRewardStats(userAddress: string) {
  const rewardsContract = getRewardsContract(); // 🆕 Get contract here
  
  const stats = await readContract({
    contract: rewardsContract,
    method: 'function getUserStats(address) view returns (uint256,uint256,uint8,uint256)',
    params: [userAddress],
  });
  
  return {
    totalPoints: Number(stats[0]),
    claimedTokens: Number(stats[1]),
    tier: Number(stats[2]),
    tokensAvailable: Number(stats[3]),
  };
}

/**
 * Check if user qualifies for Contributor role
 */
export async function checkContributorQualification(userAddress: string): Promise<boolean> {
  const rewardsContract = getRewardsContract(); // 🆕 Get contract here
  
  return await readContract({
    contract:  rewardsContract,
    method: 'function qualifiesForContributor(address) view returns (bool)',
    params: [userAddress],
  });
}
