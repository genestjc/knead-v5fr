import { type NextRequest, NextResponse } from "next/server";
import { createThirdwebClient, getContract } from "thirdweb";
import { mintTo } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";
import { verifyVipToken } from "@/lib/verify-vip-token";

const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_ADMIN_SECRET!,
});

export async function POST(req: NextRequest) {
  try {
    // Verify VIP access token
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 },
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    if (!verifyVipToken(token)) {
      return NextResponse.json(
        { error: "Invalid or expired VIP access token" },
        { status: 401 },
      );
    }

    const { user_address, email } = await req.json();

    if (!user_address || !email) {
      return NextResponse.json(
        { error: "Missing user_address or email" },
        { status: 400 },
      );
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(user_address)) {
      return NextResponse.json(
        { error: "Invalid wallet address format" },
        { status: 400 },
      );
    }

    const contract = getContract({
      client,
      chain: base,
      address: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!,
    });

    // Mint premium membership token (token ID 1)
    await mintTo({
      contract,
      to: user_address,
      tokenId: 1n, // Premium membership
      amount: 1n,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("VIP mint error:", error);
    return NextResponse.json(
      { error: "Failed to mint VIP token" },
      { status: 500 },
    );
  }
}
