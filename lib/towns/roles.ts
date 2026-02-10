/**
 * Towns Protocol Roles Configuration
 * 
 * This module manages the three-tier membership system for the Knead Magazine chat:
 * - Freemium: View-only access (default role)
 * - Participant: Can message during live events only (Premium NFT holders)
 * - Contributor: Full access, can message anytime (Contributor NFT holders)
 * 
 * Setup Requirements:
 * 1. Create Towns Space
 * 2. Set up TokenEntitlementModule roles:
 *    - Participant Role: Requires Knead Monthly NFT (token ID 1)
 *    - Contributor Role: Requires Contributor NFT (token IDs 1, 2, or 3)
 * 3. Configure bot with admin permissions
 * 4. Set environment variables for space and role IDs
 */

import { useSpace } from '@towns-protocol/react-sdk';

// ============================================
// Environment Configuration
// ============================================

/**
 * Get the Knead Chat space ID from environment
 */
export function getSpaceId(): string {
  const spaceId = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID;
  if (!spaceId) {
    throw new Error('NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID environment variable is not set');
  }
  return spaceId;
}

/**
 * Get the Participant role ID from environment
 */
export function getParticipantRoleId(): string {
  const roleId = process.env.TOWNS_PARTICIPANT_ROLE_ID;
  if (!roleId) {
    throw new Error('TOWNS_PARTICIPANT_ROLE_ID environment variable is not set');
  }
  return roleId;
}

/**
 * Get the Contributor role ID from environment
 */
export function getContributorRoleId(): string {
  const roleId = process.env.TOWNS_CONTRIBUTOR_ROLE_ID;
  if (!roleId) {
    throw new Error('TOWNS_CONTRIBUTOR_ROLE_ID environment variable is not set');
  }
  return roleId;
}

/**
 * Get role ID by role name
 * 
 * @param role - Role name ('Participant' or 'Contributor')
 * @returns Role ID from environment
 */
export function getRoleId(role: 'Participant' | 'Contributor'): string {
  return role === 'Participant' ? getParticipantRoleId() : getContributorRoleId();
}

// ============================================
// Client-Side Hooks
// ============================================

/**
 * Hook to get user roles in a Towns Space
 * 
 * Towns automatically checks NFT ownership via TokenEntitlementModule.
 * This hook provides a convenient interface to check user permissions.
 * 
 * @param spaceId - Towns Space ID
 * @param userAddress - User's wallet address
 * @returns User role information
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
