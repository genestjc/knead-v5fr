import { createThirdwebClient, getContract } from "thirdweb";
import { mintTo, balanceOf } from "thirdweb/extensions/erc1155";
import { write as writeContract } from "thirdweb/contract"; // FIXED IMPORT
import { base } from "thirdweb/chains";
import kneadMembershipABI from "../app/abi/kneadMembershipABI.json";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!;
const PREMIUM_TOKEN_ID = 1;

// Check if secret key exists
if (!process.env.THIRDWEB_SECRET_KEY) {
  throw new Error("THIRDWEB_SECRET_KEY is not defined in environment variables");
}

const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY!,
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
