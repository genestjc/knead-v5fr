/**
 * Contributor Pool Distribution Script
 * 
 * Distributes the weekly contributor pool to all NFT holders.
 * 
 * Process:
 * 1. Fetch all contributor NFT holders (Token IDs 1, 2, 3)
 * 2. Get current pool balance from Engine wallet
 * 3. Calculate weighted distribution
 * 4. Send $TOWNS to each contributor
 * 5. Log detailed summary
 * 
 * Weights:
 * - Appointed (Token ID 1): 1x
 * - Invited (Token ID 2): 2x
 * - Earned (Token ID 3): 3x
 */

import { createThirdwebClient, getContract, prepareContractCall } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { sendTransaction } from 'thirdweb/transaction';
import { serverWallet, SERVER_WALLET_ADDRESS } from '@/thirdweb-server-wallet';
import { getAllContributorHolders, getTotalContributorWeight } from '@/lib/blockchain/get-contributors';
import { getContributorPoolBalance, getParticipantStats } from '@/lib/blockchain/award-rewards-engine';

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
  console.log(`✅ Pool balance: ${poolBalance.toFixed(4)} $TOWNS\n`);

  if (poolBalance < 0.001) {
    console.log('⚠️ Pool balance too low. Minimum 0.001 $TOWNS required. Skipping distribution.');
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
  console.log(`Amount per weight unit: ${amountPerWeight.toFixed(6)} $TOWNS\n`);

  // Step 5: Distribute to each contributor
  console.log('💸 Distributing to contributors...\n');
  const distributions: DistributionResult['distributions'] = [];
  let totalDistributed = 0;

  for (const holder of holders) {
    const amount = amountPerWeight * holder.weight;
    const contributorTypeName = 
      holder.contributorType === 1 ? 'Appointed' :
      holder.contributorType === 2 ? 'Invited' : 'Earned';

    console.log(`📤 ${holder.address.substring(0, 10)}... (${contributorTypeName} - ${holder.weight}x): ${amount.toFixed(4)} $TOWNS`);

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
  console.log(`Pool balance: ${poolBalance.toFixed(4)} $TOWNS`);
  console.log(`Total distributed: ${totalDistributed.toFixed(4)} $TOWNS`);
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
  if (!SERVER_WALLET_ADDRESS) {
    throw new Error('ENGINE_SERVER_WALLET_ADDRESS not set');
  }

  const stats = await getParticipantStats(SERVER_WALLET_ADDRESS);
  
  if (stats.availableToClaim < 0.001) {
    console.log('No earnings to claim (less than 0.001 $TOWNS)');
    return;
  }

  const rewardsContractAddress = process.env.NEXT_PUBLIC_REWARDS_CONTRACT_ADDRESS;
  if (!rewardsContractAddress) {
    throw new Error('NEXT_PUBLIC_REWARDS_CONTRACT_ADDRESS not set');
  }

  const rewardsContract = getContract({
    client,
    address: rewardsContractAddress,
    chain: base,
  });

  const transaction = prepareContractCall({
    contract: rewardsContract,
    method: 'function claimRewards()',
    params: [],
  });

  const receipt = await sendTransaction({
    transaction,
    account: serverWallet,
  });

  console.log(`✅ Claimed ${stats.availableToClaim.toFixed(4)} $TOWNS (Tx: ${receipt.transactionHash})`);
}

/**
 * Send $TOWNS tokens from Engine wallet to recipient
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

  const receipt = await sendTransaction({
    transaction,
    account: serverWallet,
  });

  return receipt.transactionHash;
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
