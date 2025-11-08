import {
  createThirdwebClient,
  getContract,
} from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { balanceOf as erc721BalanceOf } from "thirdweb/extensions/erc721";
import { base, zora } from "thirdweb/chains";

const MEMBERSHIP_CONTRACTS = [
  {
    address: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!,
    name: "Knead Membership",
    type: "erc1155",
    tokenIds: { premium: 1, freemium: 0 },
    chain: base,
  },
  {
    address: "0x0e70AB324E8761E97F131Eecc4Dd63dFDE33cB72",
    name: "Breadwinner's Club Membership",
    type: "erc721",
    chain: zora,
  },
  {
    address: "0xa4b1aF8cffEE71D71721cB69596C9A31ac449F13",
    name: "2025 Annual + Shift Meal Membership",
    type: "erc1155",
    tokenIds: { annual: 1, shift: 2 },
    chain: zora,
  },
] as const;

export type MembershipType = "premium" | "freemium" | null;

export async function getMembershipType(
  client: any,
  address: string,
): Promise<MembershipType> {
  try {
    console.log(`🔍 Starting comprehensive membership check for: ${address}`);
    
    for (const contract of MEMBERSHIP_CONTRACTS) {
      console.log(`📋 Checking contract: ${contract.name} on ${contract.chain.name || contract.chain.id}`);
      
      try {
        const contractInstance = getContract({
          client,
          chain: contract.chain,
          address: contract.address,
        });

        if (contract.type === "erc1155" && contract.tokenIds) {
          // Premium
          if (contract.tokenIds.premium !== undefined) {
            try {
              console.log(`⚡ Checking premium token (ID: ${contract.tokenIds.premium})`);
              const premiumBalance = await balanceOf({
                contract: contractInstance,
                owner: address,
                tokenId: BigInt(contract.tokenIds.premium),
              });
              console.log(`📊 Balance: ${premiumBalance}`);
              if (premiumBalance > 0n) {
                console.log(`✅ Found premium membership in ${contract.name}!`);
                return "premium";
              }
            } catch (err) {
              console.error(`Error checking premium token for ${contract.name}:`, err);
              // Continue checking other tokens
            }
          }
          
          // Other tokens (annual, shift, etc.)
          for (const [tokenType, tokenId] of Object.entries(contract.tokenIds)) {
            if (tokenType !== "premium" && tokenType !== "freemium") {
              try {
                console.log(`⚡ Checking ${tokenType} token (ID: ${tokenId})`);
                const balance = await balanceOf({
                  contract: contractInstance,
                  owner: address,
                  tokenId: BigInt(tokenId),
                });
                console.log(`📊 Balance: ${balance}`);
                if (balance > 0n) {
                  console.log(`✅ Found ${tokenType} membership in ${contract.name}!`);
                  return "premium";
                }
              } catch (err) {
                console.error(`Error checking ${tokenType} token:`, err);
                // Continue checking other tokens
              }
            }
          }
          
          // Freemium
          if (contract.tokenIds.freemium !== undefined) {
            try {
              console.log(`⚡ Checking freemium token (ID: ${contract.tokenIds.freemium})`);
              const freemiumBalance = await balanceOf({
                contract: contractInstance,
                owner: address,
                tokenId: BigInt(contract.tokenIds.freemium),
              });
              console.log(`📊 Balance: ${freemiumBalance}`);
              if (freemiumBalance > 0n) {
                console.log(`✅ Found freemium membership in ${contract.name}!`);
                return "freemium";
              }
            } catch (err) {
              console.error(`Error checking freemium token for ${contract.name}:`, err);
              // Continue checking other contracts
            }
          }
        } else if (contract.type === "erc721") {
          try {
            console.log(`⚡ Checking ERC721 balance`);
            const balance = await erc721BalanceOf({
              contract: contractInstance,
              owner: address,
            });
            console.log(`📊 Balance: ${balance}`);
            if (balance > 0n) {
              console.log(`✅ Found ERC721 membership in ${contract.name}!`);
              return "premium";
            }
          } catch (err) {
            console.error(`Error checking ERC721 balance for ${contract.name}:`, err);
            // Continue checking other contracts
          }
        }
      } catch (contractErr) {
        console.error(`Error with contract ${contract.name}:`, contractErr);
        // Continue checking other contracts
      }
    }
    
    console.log(`❌ No membership found`);
    return null;
  } catch (error) {
    console.error("Error in getMembershipType:", error);
    throw error;
  }
}
