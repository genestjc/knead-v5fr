import { useSpace } from '@towns-protocol/react-sdk';
import { checkContributorQualification } from '@/lib/blockchain/rewards-contract';

/**
 * Configure Towns Space with TokenEntitlementModule
 * 
 * Setup Instructions:
 * 1. Deploy KneadRewards contract
 * 2. Create Towns Space
 * 3. Add TokenEntitlementModule for:
 *    - Participant Role: Premium NFT (token ID 1)
 *    - Contributor Role: Contributor NFT (token IDs 10, 11, 12)
 *    - Admin Role: Owner NFT (automatic)
 */

export function useUserRoles(spaceId: string, userAddress: string) {
  const { data: space } = useSpace(spaceId);
  
  // Towns automatically checks NFT ownership via TokenEntitlementModule
  const roles = space?.userRoles?.[userAddress] || [];
  
  return {
    isParticipant: roles.includes('Participant'),
    isContributor: roles.includes('Contributor'),
    isAdmin: roles.includes('Owner') || roles.includes('Admin'),
    canPost: roles.length > 0, // Any role can post
    canAwardPoints: roles.includes('Contributor') || roles.includes('Owner'),
  };
}
