import { NextRequest, NextResponse } from "next/server";
import {
  createThirdwebClient,
  getContract,
} from "thirdweb";
import { mintTo } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";

// Your contract address and token ID
const CONTRACT_ADDRESS =
  "0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85";
const FREEMIUM_TOKEN_ID = 0;

// Optionally, specify the chain (e.g., "base", "polygon", "ethereum", or chainId)
const CHAIN = "base"; // Change to your chain

export async function POST(req: NextRequest) {
  const { user_address } = await req.json();
  if (!user_address) {
    return NextResponse.json(
      { error: "Missing user_address" },
      { status: 400 },
    );
  }

  try {
    // Initialize the thirdweb client with your secret key
    const client = createThirdwebClient({
      secretKey: process.env.THIRDWEB_SECRET_KEY,
    });

    // Get the contract instance
    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: CHAIN,
    });

    // Mint the ERC1155 token to the user
    const tx = await mintTo({
      contract,
      to: user_address,
      tokenId: BigInt(FREEMIUM_TOKEN_ID),
      amount: 1n,
    });

    return NextResponse.json({ success: true, tx });
  } catch (error: any) {
    console.error("Mint error:", error);
    return NextResponse.json(
      { error: error.message || "Mint failed" },
      { status: 500 },
    );
  }
}
