import { ethers } from "ethers";
import kneadMembershipABI from "@/app/abi/kneadMembershipABI.json";

const CONTRACT_ADDRESS =
  "0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85";
const PREMIUM_TOKEN_ID = 1;

export async function mintPremiumNFT(
  walletAddress: string,
) {
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

  const tx = await contract.mint(
    walletAddress,
    PREMIUM_TOKEN_ID,
    1,
  );
  await tx.wait();
}

export async function burnPremiumNFT(
  walletAddress: string,
) {
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

  const tx = await contract.adminBurn(
    walletAddress,
    PREMIUM_TOKEN_ID,
    1,
  );
  await tx.wait();
}
