import { NextRequest, NextResponse } from "next/server";
import { createThirdwebClient, getContract } from "thirdweb";
import { mintTo, balanceOf } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!;
const FREEMIUM_TOKEN_ID = 0;
const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_ADMIN_SECRET!,
});

export async function POST(req: NextRequest) {
  const { user_address } = await req.json();
  if (!user_address) {
    return NextResponse.json(
      { error: "Missing user_address" },
      { status: 400 },
    );
  }

  try {
    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: base,
    });

    // Idempotency: only mint if not already owned
    const balance = await balanceOf({
      contract,
      owner: user_address,
      tokenId: 0n,
    });
    if (balance > 0n) {
      return NextResponse.json({ success: true, alreadyMinted: true });
    }

    await mintTo({
      contract,
      to: user_address,
      tokenId: 0n,
      amount: 1n,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Mint error:", error);
    return NextResponse.json(
      { error: error.message || "Mint failed" },
      { status: 500 },
    );
  }
}
