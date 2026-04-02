/**
 * Contributor Pool Distribution Script
 * 
 * Distributes the weekly contributor pool to all NFT holders.
 * 
 * Process:
 * 1. Fetch all contributor NFT holders (Token IDs 1, 2, 3)
 * 2. Get current pool balance from Engine wallet
 * 3. Calculate weighted distribution
 * 4. Send USDC to each contributor
 * 5. Log detailed summary
 * 
 * Weights (same for all):
 * - Appointed (Token ID 1): 1x weight
 * - Invited (Token ID 2): 2x weight
 * - Earned (Token ID 3): 3x weight
 */

import { createThirdwebClient, getContract, prepareContractCall, Engine } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { serverWallet } from '@/thirdweb-server-wallet';
import { getAllContributorHolders, getTotalContributorWeight } from '@/lib/blockchain/get-contributors';
import { getContributorPoolBalance } from '@/lib/blockchain/award-rewards-engine';

const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY!,
});

interface DistributionResult {
  totalDistributed: number;
  contributorCount: number;
  distributions: Array<{
    address: string;
    contributorType: string;
    weight: number;
    amount: number;
    transactionHash?: string;
    error?: string;
  }>;
}

/**
 * Main distribution function
 */
export async function distributeContributorPool(): Promise<DistributionResult> {
  console.log('🚀 Starting contributor pool distribution...\n');

  // Step 1: Get all contributor holders
  console.log('📋 Fetching all contributor NFT holders...');
  const holders = await getAllContributorHolders();
  
  if (holders.length === 0) {
    console.log('⚠️ No contributors found. Skipping distribution.');
    return {
      totalDistributed: 0,
      contributorCount: 0,
      distributions: [],
    };
  }

  console.log(`✅ Found ${holders.length} contributors\n`);

  // Step 2: Get pool balance
  console.log('💰 Fetching pool balance...');
  const poolBalance = await getContributorPoolBalance();
  console.log(`✅ Pool balance: $${poolBalance.toFixed(2)}\n`);

  if (poolBalance < 0.001) {
    console.log('⚠️ Pool balance too low. Minimum $0.001 required. Skipping distribution.');
    return {
      totalDistributed: 0,
      contributorCount: holders.length,
      distributions: [],
    };
  }

  // Step 3: Claim pool balance from rewards contract (if needed)
  console.log('🔄 Claiming accumulated earnings from rewards contract...');
  try {
    await claimEngineEarnings();
    console.log('✅ Earnings claimed\n');
  } catch (error) {
    console.log('⚠️ No earnings to claim or claim not needed:', error);
  }

  // Step 4: Calculate weighted distribution
  console.log('🧮 Calculating weighted distribution...');
  const totalWeight = await getTotalContributorWeight();
  const amountPerWeight = poolBalance / totalWeight;
  
  console.log(`Total weight: ${totalWeight}`);
  console.log(`Amount per weight unit: $${amountPerWeight.toFixed(2)}\n`);

  // Step 5: Distribute to each contributor
  console.log('💸 Distributing to contributors...\n');
  const distributions: DistributionResult['distributions'] = [];
  let totalDistributed = 0;

  for (const holder of holders) {
    const amount = amountPerWeight * holder.weight;
    const contributorTypeName = 
      holder.contributorType === 1 ? 'Appointed' :
      holder.contributorType === 2 ? 'Invited' : 'Earned';

    console.log(`📤 ${holder.address.substring(0, 10)}... (${contributorTypeName} - ${holder.weight}x): $${amount.toFixed(2)}`);

    try {
      const txHash = await sendTownsTokens(holder.address, amount);
      console.log(`   ✅ Sent! Tx: ${txHash.substring(0, 20)}...`);
      
      distributions.push({
        address: holder.address,
        contributorType: contributorTypeName,
        weight: holder.weight,
        amount,
        transactionHash: txHash,
      });
      
      totalDistributed += amount;

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
      distributions.push({
        address: holder.address,
        contributorType: contributorTypeName,
        weight: holder.weight,
        amount,
        error: error.message,
      });
    }
  }

  // Step 6: Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DISTRIBUTION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total contributors: ${holders.length}`);
  console.log(`Pool balance: $${poolBalance.toFixed(2)}`);
  console.log(`Total distributed: $${totalDistributed.toFixed(2)}`);
  console.log(`Successful: ${distributions.filter(d => d.transactionHash).length}`);
  console.log(`Failed: ${distributions.filter(d => d.error).length}`);
  console.log('='.repeat(60) + '\n');

  return {
    totalDistributed,
    contributorCount: holders.length,
    distributions,
  };
}

/**
 * Claim accumulated earnings for the Engine wallet from rewards contract
 */
async function claimEngineEarnings(): Promise<void> {
  // TODO: Implement earnings claim for KneadRewardsV5
  // KneadRewardsV5 uses claimCashback() and claimTowns() instead of claimRewards()
  console.log('ℹ️ Earnings claim skipped - pending KneadRewardsV5 implementation');
  return;
}

/**
 * Send tokens from Engine wallet to recipient
 */
async function sendTownsTokens(recipientAddress: string, amount: number): Promise<string> {
  const townsContractAddress = process.env.NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS;
  
  if (!townsContractAddress) {
    throw new Error('NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS not set');
  }

  const townsContract = getContract({
    client,
    address: townsContractAddress,
    chain: base,
  });

  // Convert amount to wei (18 decimals)
  const amountInWei = BigInt(Math.floor(amount * 1e18));

  const transaction = prepareContractCall({
    contract: townsContract,
    method: 'function transfer(address to, uint256 amount) returns (bool)',
    params: [recipientAddress, amountInWei],
  });

  const { transactionId } = await serverWallet.enqueueTransaction({
    transaction,
  });

  const { transactionHash } = await Engine.waitForTransactionHash({
    client,
    transactionId,
  });

  return transactionHash;
}

// Allow running as standalone script
if (require.main === module) {
  distributeContributorPool()
    .then((result) => {
      console.log('✅ Distribution completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Distribution failed:', error);
      process.exit(1);
    });
}
