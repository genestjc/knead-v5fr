import { createThirdwebClient, getContract } from "thirdweb";
import { mintTo, balanceOf } from "thirdweb/extensions/erc1155";
import { writeContract } from "thirdweb";
import { base } from "thirdweb/chains";
import kneadMembershipABI from "../app/abi/kneadMembershipABI.json";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!;
const PREMIUM_TOKEN_ID = 1;
const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_ADMIN_SECRET!,
});

export async function mintPremiumNFT(walletAddress: string) {
  const contract = getContract({
    client,
    address: CONTRACT_ADDRESS,
    chain: base,
    abi: kneadMembershipABI,
  });
  // Idempotency: only mint if not already owned
  const balance = await balanceOf({
    contract,
    owner: walletAddress,
    tokenId: BigInt(PREMIUM_TOKEN_ID),
  });
  if (balance > 0n) return;
  await mintTo({
    contract,
    to: walletAddress,
    tokenId: BigInt(PREMIUM_TOKEN_ID),
    amount: 1n,
  });
}

export async function burnPremiumNFT(walletAddress: string) {
  const contract = getContract({
    client,
    address: CONTRACT_ADDRESS,
    chain: base,
    abi: kneadMembershipABI,
  });
  // Idempotency: only burn if owned
  const balance = await balanceOf({
    contract,
    owner: walletAddress,
    tokenId: BigInt(PREMIUM_TOKEN_ID),
  });
  if (balance === 0n) return;
  await writeContract({
    contract,
    method: "adminBurn",
    params: [walletAddress, BigInt(PREMIUM_TOKEN_ID), 1n],
  });
}
