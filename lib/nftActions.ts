import { ethers } from "ethers";
import kneadMembershipABI from "@/app/abi/kneadMembershipABI.json";

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!;
const PAID_TOKEN_ID = 1;

const provider = new ethers.JsonRpcProvider(
  process.env.BASE_RPC_URL!,
);
const wallet = new ethers.Wallet(
  process.env.THIRDWEB_PRIVATE_KEY!,
  provider,
);
const contract = new ethers.Contract(
  CONTRACT_ADDRESS,
  kneadMembershipABI,
  wallet,
);

/**
 * Mint the PAID (Token 1) membership NFT to a user.
 */
export async function mintPremiumNFT(userAddress: string) {
  const tx = await contract.mint(
    userAddress,
    PAID_TOKEN_ID,
    1,
  );
  await tx.wait();
}

/**
 * Burn the PAID (Token 1) membership NFT from a user.
 */
export async function burnPremiumNFT(userAddress: string) {
  const tx = await contract.adminBurn(
    userAddress,
    PAID_TOKEN_ID,
    1,
  );
  await tx.wait();
}
