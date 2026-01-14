import { getContract } from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";
import { logger } from "./logger";

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
    logger.log(`🔍 Starting simplified membership check for: ${address}`);
    
    const contractInfo = MEMBERSHIP_CONTRACTS[0];
    
    logger.log(`📋 Checking contract: ${contractInfo.name} on ${contractInfo.chain.name || contractInfo.chain.id}`);
      
    const contractInstance = getContract({
      client,
      chain: contractInfo.chain,
      address: contractInfo.address,
    });

    // Parallelize balance checks for better performance (~50% faster)
    logger.log(`⚡ Checking premium and freemium tokens in parallel`);
    const [premiumBalance, freemiumBalance] = await Promise.all([
      balanceOf({
        contract: contractInstance,
        owner: address,
        tokenId: BigInt(contractInfo.tokenIds.premium),
      }).catch(err => {
        logger.error(`Error checking premium token for ${contractInfo.name}:`, err);
        return 0n;
      }),
      balanceOf({
        contract: contractInstance,
        owner: address,
        tokenId: BigInt(contractInfo.tokenIds.freemium),
      }).catch(err => {
        logger.error(`Error checking freemium token for ${contractInfo.name}:`, err);
        return 0n;
      })
    ]);

    if (premiumBalance > 0n) {
      logger.log(`✅ Found premium membership in ${contractInfo.name}!`);
      return "premium";
    }

    if (freemiumBalance > 0n) {
      logger.log(`✅ Found freemium membership in ${contractInfo.name}!`);
      return "freemium";
    }
    
    // 3. If neither token is found, return null.
    logger.log(`🚫 No membership found for address: ${address}`);
    return null;

  } catch (error) {
    logger.error("A general error occurred in getMembershipType:", error);
    // Return null on any unexpected errors to prevent accidental access.
    return null;
  }
}
