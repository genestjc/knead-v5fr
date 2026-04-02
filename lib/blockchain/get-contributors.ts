/**
 * Get Contributors
 * 
 * Functions to query all contributor NFT holders for pool distribution.
 * Uses Thirdweb API to fetch all owners of contributor NFTs (Token IDs 1, 2, 3).
 */

const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY;
const CONTRIBUTOR_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS;
const CHAIN_NAME = 'base';

export enum ContributorType {
  Appointed = 1, // Token ID 1 - 1x weight
  Invited = 2,   // Token ID 2 - 2x weight
  Earned = 3,    // Token ID 3 - 3x weight
}

export interface ContributorHolder {
  address: string;
  contributorType: ContributorType;
  weight: number;
}

/**
 * Fetch all owners of a specific ERC1155 token ID
 * 
 * @param tokenId - The contributor token ID (1, 2, or 3)
 * @returns Array of wallet addresses
 */
async function getOwnersFromApi(tokenId: bigint): Promise<string[]> {
  if (!THIRDWEB_SECRET_KEY || !CONTRIBUTOR_CONTRACT_ADDRESS) {
    throw new Error('Missing Thirdweb environment variables for fetching contributors');
  }

  const url = `https://api.thirdweb.com/v1/contract/${CHAIN_NAME}/${CONTRIBUTOR_CONTRACT_ADDRESS}/erc1155/${tokenId}/owners?limit=50000`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${THIRDWEB_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Thirdweb API failed for token ${tokenId}: ${response.status} ${errorBody}`);
      return [];
    }

    const data = await response.json();
    return data.result?.owners || [];
  } catch (error) {
    console.error(`Failed to fetch owners for token ${tokenId}:`, error);
    return [];
  }
}

/**
 * Get all contributor NFT holders with their types and weights
 * 
 * Returns all holders of contributor NFTs:
 * - Token ID 1: Appointed (1x weight)
 * - Token ID 2: Invited (2x weight)
 * - Token ID 3: Earned (3x weight)
 * 
 * @returns Array of contributor holders with weights
 */
export async function getAllContributorHolders(): Promise<ContributorHolder[]> {
  // Fetch all three token types in parallel
  const [appointed, invited, earned] = await Promise.all([
    getOwnersFromApi(1n), // Appointed
    getOwnersFromApi(2n), // Invited
    getOwnersFromApi(3n), // Earned
  ]);

  const holders: ContributorHolder[] = [];

  // Map appointed contributors (1x weight)
  appointed.forEach(address => {
    holders.push({
      address: address.toLowerCase(),
      contributorType: ContributorType.Appointed,
      weight: 1,
    });
  });

  // Map invited contributors (2x weight)
  invited.forEach(address => {
    holders.push({
      address: address.toLowerCase(),
      contributorType: ContributorType.Invited,
      weight: 2,
    });
  });

  // Map earned contributors (3x weight)
  earned.forEach(address => {
    holders.push({
      address: address.toLowerCase(),
      contributorType: ContributorType.Earned,
      weight: 3,
    });
  });

  // If same address holds multiple NFTs, use the highest weight
  const uniqueHolders = new Map<string, ContributorHolder>();
  holders.forEach(holder => {
    const existing = uniqueHolders.get(holder.address);
    if (!existing || holder.weight > existing.weight) {
      uniqueHolders.set(holder.address, holder);
    }
  });

  return Array.from(uniqueHolders.values());
}

/**
 * Get the total weight of all contributors
 * 
 * @returns Sum of all contributor weights
 */
export async function getTotalContributorWeight(): Promise<number> {
  const holders = await getAllContributorHolders();
  return holders.reduce((sum, holder) => sum + holder.weight, 0);
}
