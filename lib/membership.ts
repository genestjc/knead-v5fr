// lib/membership.ts
import {
  createThirdwebClient,
  getContract,
} from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { balanceOf as erc721BalanceOf } from "thirdweb/extensions/erc721";
import { base } from "thirdweb/chains";

const MEMBERSHIP_CONTRACTS = [
  {
    address: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!,
    name: "Knead Membership",
    type: "erc1155",
    tokenIds: { premium: 1, freemium: 0 },
  },
  {
    address: "0x0e70AB324E8761E97F131Eecc4Dd63dFDE33cB72",
    name: "Breadwinner's Club Membership",
    type: "erc721",
  },
  {
    address: "0xa4b1aF8cffEE71D71721cB69596C9A31ac449F13",
    name: "2025 Annual + Shift Meal Membership",
    type: "erc1155",
    tokenIds: { annual: 1, shift: 2 },
  },
] as const;

export type MembershipType = "premium" | "freemium" | null;

export async function getMembershipType(
  client: any,
  address: string,
): Promise<MembershipType> {
  for (const contract of MEMBERSHIP_CONTRACTS) {
    const contractInstance = getContract({
      client,
      chain: base,
      address: contract.address,
    });

    if (contract.type === "erc1155" && contract.tokenIds) {
      // Premium
      if (contract.tokenIds.premium !== undefined) {
        const premiumBalance = await balanceOf({
          contract: contractInstance,
          owner: address,
          tokenId: BigInt(contract.tokenIds.premium),
        });
        if (premiumBalance > 0n) return "premium";
      }
      // Other tokens (annual, shift, etc.)
      for (const [tokenType, tokenId] of Object.entries(
        contract.tokenIds,
      )) {
        if (
          tokenType !== "premium" &&
          tokenType !== "freemium"
        ) {
          const balance = await balanceOf({
            contract: contractInstance,
            owner: address,
            tokenId: BigInt(tokenId),
          });
          if (balance > 0n) return "premium";
        }
      }
      // Freemium
      if (contract.tokenIds.freemium !== undefined) {
        const freemiumBalance = await balanceOf({
          contract: contractInstance,
          owner: address,
          tokenId: BigInt(contract.tokenIds.freemium),
        });
        if (freemiumBalance > 0n) return "freemium";
      }
    } else if (contract.type === "erc721") {
      const balance = await erc721BalanceOf({
        contract: contractInstance,
        owner: address,
      });
      if (balance > 0n) return "premium";
    }
  }
  return null;
}
