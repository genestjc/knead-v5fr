import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const KNEAD_CONTRIBUTORS_ADDRESS = '0x...'; // Your contract address

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

/**
 * Check if address has earned contributor NFT on-chain
 */
export async function hasContributorNFT(address: string): Promise<boolean> {
  try {
    const balance = await publicClient.readContract({
      address: KNEAD_CONTRIBUTORS_ADDRESS,
      abi: [
        {
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'owner', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        },
      ],
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    });

    return balance > 0n;
  } catch (error) {
    console.error('Failed to check contributor NFT:', error);
    return false;
  }
}
