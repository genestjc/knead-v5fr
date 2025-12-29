import { getContract } from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";

// The only contract that will be checked for membership.
const MEMBERSHIP_CONTRACTS = [
  {
    address: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!,
    name: "Knead Membership",
    type: "erc1155",
    tokenIds: { premium: 1, freemium: 0 },
    chain: base,
  },
] as const;

export type MembershipType = "premium" | "freemium" | null;

/**
 * Checks the user's membership status against the single, primary membership contract.
 * It first checks for a premium token, then for a freemium token.
 * @param client The Thirdweb client instance.
 * @param address The user's wallet address.
 * @returns "premium", "freemium", or null.
 */
export async function getMembershipType(
  client: any,
  address: string,
): Promise<MembershipType> {
  try {
    console.log(`🔍 Starting simplified membership check for: ${address}`);
    
    const contractInfo = MEMBERSHIP_CONTRACTS[0];
    
    console.log(`📋 Checking contract: ${contractInfo.name} on ${contractInfo.chain.name || contractInfo.chain.id}`);
      
    const contractInstance = getContract({
      client,
      chain: contractInfo.chain,
      address: contractInfo.address,
    });

    // 1. Check for the premium token first.
    try {
      console.log(`⚡ Checking premium token (ID: ${contractInfo.tokenIds.premium})`);
      const premiumBalance = await balanceOf({
        contract: contractInstance,
        owner: address,
        tokenId: BigInt(contractInfo.tokenIds.premium),
      });

      if (premiumBalance > 0n) {
        console.log(`✅ Found premium membership in ${contractInfo.name}!`);
        return "premium";
      }
    } catch (err) {
      console.error(`Error checking premium token for ${contractInfo.name}:`, err);
      // If premium check fails, we can still check for freemium.
    }
    
    // 2. If not premium, check for the freemium token.
    try {
      console.log(`⚡ Checking freemium token (ID: ${contractInfo.tokenIds.freemium})`);
      const freemiumBalance = await balanceOf({
        contract: contractInstance,
        owner: address,
        tokenId: BigInt(contractInfo.tokenIds.freemium),
      });

      if (freemiumBalance > 0n) {
        console.log(`✅ Found freemium membership in ${contractInfo.name}!`);
        return "freemium";
      }
    } catch (err) {
      console.error(`Error checking freemium token for ${contractInfo.name}:`, err);
    }
    
    // 3. If neither token is found, return null.
    console.log(`🚫 No membership found for address: ${address}`);
    return null;

  } catch (error) {
    console.error("A general error occurred in getMembershipType:", error);
    // Return null on any unexpected errors to prevent accidental access.
    return null;
  }
}
