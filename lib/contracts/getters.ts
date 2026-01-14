/**
 * Centralized Contract Getters
 * 
 * Provides memoized contract instances to avoid redundant initialization.
 * All API routes should use these getters instead of creating contracts directly.
 */

import { getContract } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { client } from '@/thirdweb-server-wallet';
import kneadMembershipABI from '@/app/abi/kneadMembershipABI.json';

// Memoized contract instances
let _membershipContract: ReturnType<typeof getContract> | null = null;
let _contributorContract: ReturnType<typeof getContract> | null = null;

/**
 * Get the membership contract instance (ERC1155)
 * Memoized to avoid redundant initialization
 */
export function getMembershipContract() {
  if (!_membershipContract) {
    const address = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS;
    if (!address) {
      throw new Error('NEXT_PUBLIC_NFT_CONTRACT_ADDRESS is required');
    }
    
    _membershipContract = getContract({
      client,
      address,
      chain: base,
      abi: kneadMembershipABI,
    });
  }
  return _membershipContract;
}

/**
 * Get the contributor contract instance
 * Memoized to avoid redundant initialization
 */
export function getContributorContract() {
  if (!_contributorContract) {
    const address = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS;
    if (!address) {
      throw new Error('NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS is required');
    }
    
    _contributorContract = getContract({
      client,
      address,
      chain: base,
    });
  }
  return _contributorContract;
}
