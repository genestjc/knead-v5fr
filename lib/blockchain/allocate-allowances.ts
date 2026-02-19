/**
 * Allocate Weekly Allowances
 *
 * Server-side functions for allocating weekly allowances to contributors
 * via the rewards contract.
 *
 * ⚠️ SERVER-ONLY: This file uses secret keys and must never be imported in client components!
 */

import { createThirdwebClient, getContract, prepareContractCall } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { sendTransaction } from 'thirdweb/transaction';
import { serverWallet } from '@/thirdweb-server-wallet';
import { getAllContributorHolders } from './get-contributors';

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
 * Allocate weekly allowances to a batch of contributors.
 *
 * @param contributorAddresses - Array of contributor wallet addresses
 * @returns Transaction hash
 */
export async function allocateWeeklyAllowances(
  contributorAddresses: string[]
): Promise<{ transactionHash: string; count: number }> {
  if (contributorAddresses.length === 0) {
    throw new Error('No contributor addresses provided');
  }

  const contract = getRewardsContract();

  const transaction = prepareContractCall({
    contract,
    method: 'function batchAllocateWeeklyAllowances(address[] _contributors)',
    params: [contributorAddresses],
  });

  const receipt = await sendTransaction({
    transaction,
    account: serverWallet,
  });

  console.log('✅ Weekly allowances allocated:', {
    count: contributorAddresses.length,
    txHash: receipt.transactionHash,
  });

  return {
    transactionHash: receipt.transactionHash,
    count: contributorAddresses.length,
  };
}

/**
 * Fetch all on-chain contributor addresses for batch operations.
 *
 * @returns Array of unique contributor wallet addresses
 */
export async function getAllContributors(): Promise<string[]> {
  const holders = await getAllContributorHolders();
  return holders.map((h) => h.address);
}

/**
 * Update a contributor's weekly budget on the rewards contract.
 *
 * @param contributorAddress - Contributor wallet address
 * @param newBudget - New weekly budget in TOWNS (not wei)
 * @returns Transaction hash
 */
export async function updateContributorBudget(
  contributorAddress: string,
  newBudget: number
): Promise<{ transactionHash: string }> {
  const contract = getRewardsContract();

  const newBudgetWei = BigInt(Math.floor(newBudget * 1e18));

  const transaction = prepareContractCall({
    contract,
    method: 'function updateContributorBudget(address _contributor, uint256 _newBudget)',
    params: [contributorAddress, newBudgetWei],
  });

  const receipt = await sendTransaction({
    transaction,
    account: serverWallet,
  });

  console.log('✅ Contributor budget updated:', {
    address: contributorAddress,
    newBudget,
    txHash: receipt.transactionHash,
  });

  return {
    transactionHash: receipt.transactionHash,
  };
}
