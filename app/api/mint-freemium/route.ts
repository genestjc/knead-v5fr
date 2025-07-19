import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import kneadMembershipABI from "@/app/abi/kneadMembershipABI.json";

const CONTRACT_ADDRESS =
  "0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85";
const FREEMIUM_TOKEN_ID = 0;

export async function POST(req: NextRequest) {
  const { user_address } = await req.json();

  // Debug: log the address being used
  console.log("Minting freemium NFT to:", user_address);

  if (!user_address || !ethers.isAddress(user_address)) {
    return NextResponse.json(
      { error: "Missing or invalid user_address" },
      { status: 400 },
    );
  }

  try {
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

    // Mint to the user's address
    const tx = await contract.mint(
      user_address,
      FREEMIUM_TOKEN_ID,
      1,
    );
    await tx.wait();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Minting error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }
}
