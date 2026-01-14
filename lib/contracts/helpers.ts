/**
 * Contract Helper Functions
 * 
 * Shared blockchain operation helpers to reduce code duplication
 */

import { balanceOf } from 'thirdweb/extensions/erc1155';
import { getMembershipContract } from './getters';

/**
 * Check if a user owns a specific token
 * @param address - Wallet address to check
 * @param tokenId - Token ID to check (0 for freemium, 1 for premium)
 * @returns Object with ownership status and balance
 */
export async function checkTokenOwnership(
  address: string,
  tokenId: bigint
): Promise<{ owned: boolean; balance: bigint }> {
  const contract = getMembershipContract();
  
  const balance = await balanceOf({
    contract,
    owner: address,
    tokenId,
  });

  return {
    owned: balance > 0n,
    balance
  };
}

/**
 * Check membership type by checking both premium and freemium tokens in parallel
 * @param address - Wallet address to check
 * @returns 'premium' | 'freemium' | null
 */
export async function checkMembershipType(
  address: string
): Promise<'premium' | 'freemium' | null> {
  const contract = getMembershipContract();
  
  // Parallelize balance checks for better performance
  const [premiumBalance, freemiumBalance] = await Promise.all([
    balanceOf({ contract, owner: address, tokenId: 1n }),
    balanceOf({ contract, owner: address, tokenId: 0n })
  ]);

  if (premiumBalance > 0n) return 'premium';
  if (freemiumBalance > 0n) return 'freemium';
  return null;
}
