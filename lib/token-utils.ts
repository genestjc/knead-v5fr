import { getContract } from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { balanceOf as erc721BalanceOf } from "thirdweb/extensions/erc721";
import { base } from "thirdweb/chains";

/**
 * Check balances for multiple ERC1155 token IDs at once
 */
export async function checkMultipleTokenBalances(
  client: any,
  contractAddress: string,
  walletAddress: string,
  tokenIds: number[]
): Promise<Map<number, bigint>> {
  const results = new Map<number, bigint>();
  
  try {
    const contract = getContract({
      client,
      address: contractAddress,
      chain: base,
    });
    
    // Check each token ID
    for (const tokenId of tokenIds) {
      try {
        const balance = await balanceOf({
          contract,
          owner: walletAddress,
          tokenId: BigInt(tokenId),
        });
        
        results.set(tokenId, balance);
      } catch (err) {
        console.error(`Error checking token ID ${tokenId}:`, err);
        results.set(tokenId, 0n);
      }
    }
  } catch (error) {
    console.error("Error in checkMultipleTokenBalances:", error);
    // Set all balances to 0 on error
    for (const tokenId of tokenIds) {
      results.set(tokenId, 0n);
    }
  }
  
  return results;
}

/**
 * Check if a wallet has any ERC721 NFT from a contract
 */
export async function hasAnyERC721(
  client: any,
  contractAddress: string,
  walletAddress: string
): Promise<boolean> {
  try {
    const contract = getContract({
      client,
      address: contractAddress,
      chain: base,
    });
    
    const balance = await erc721BalanceOf({
      contract,
      owner: walletAddress,
    });
    
    return balance > 0n;
  } catch (error) {
    console.error(`Error checking ERC721 balance for ${contractAddress}:`, error);
    return false;
  }
}

/**
 * Check if wallet has a specific ERC1155 token
 */
export async function hasERC1155Token(
  client: any,
  contractAddress: string,
  walletAddress: string,
  tokenId: number
): Promise<boolean> {
  try {
    const contract = getContract({
      client,
      address: contractAddress,
      chain: base,
    });
    
    const balance = await balanceOf({
      contract,
      owner: walletAddress,
      tokenId: BigInt(tokenId),
    });
    
    return balance > 0n;
  } catch (error) {
    console.error(`Error checking token ID ${tokenId}:`, error);
    return false;
  }
}
