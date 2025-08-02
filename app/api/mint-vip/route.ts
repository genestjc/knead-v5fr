import {
  type NextRequest,
  NextResponse,
} from "next/server";
import {
  createThirdwebClient,
  getContract,
} from "thirdweb";
import {
  mintTo,
  balanceOf,
} from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";
import { verifyVipToken } from "@/lib/verify-vip-token";
import { createClient } from "@supabase/supabase-js";

// Check if secret key exists
if (!process.env.THIRDWEB_SECRET_KEY) {
  throw new Error(
    "THIRDWEB_SECRET_KEY is not defined in environment variables",
  );
}

const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY!,
});

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    // Verify VIP access token
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error: "Missing or invalid authorization header",
        },
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

    if (!user_address) {
      return NextResponse.json(
        { error: "Missing user_address" },
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
      address:
        process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!,
    });

    // Check if user already has a premium token (idempotence)
    const balance = await balanceOf({
      contract,
      owner: user_address,
      tokenId: 1n, // Premium membership
    });

    if (balance > 0n) {
      return NextResponse.json({
        success: true,
        alreadyMinted: true,
        message: "User already has a premium membership",
      });
    }

    // Mint premium membership token (token ID 1)
    await mintTo({
      contract,
      to: user_address,
      tokenId: 1n, // Premium membership
      amount: 1n,
    });

    // Record in Supabase
    if (email) {
      await supabase.from("users").upsert({
        wallet_address: user_address,
        email: email,
        membership_status: "premium",
        membership_type: "vip",
        created_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      message: "VIP membership minted successfully",
    });
  } catch (error) {
    console.error("VIP mint error:", error);
    return NextResponse.json(
      { error: "Failed to mint VIP token" },
      { status: 500 },
    );
  }
}
