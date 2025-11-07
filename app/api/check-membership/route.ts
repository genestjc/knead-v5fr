import { NextRequest, NextResponse } from "next/server";
import {
  createThirdwebClient,
  getContract,
} from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";
import kneadMembershipABI from "../../abi/kneadMembershipABI.json";
import { createClient } from "@supabase/supabase-js";

// Token IDs
const FREEMIUM_TOKEN_ID = 0;
const PREMIUM_TOKEN_ID = 1;
const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!;

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// thirdweb client
const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  if (!address) {
    return NextResponse.json(
      { error: "Missing address" },
      { status: 400 },
    );
  }

  try {
    // 1. Check ERC1155 contract (PRIMARY source of truth)
    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: base,
      abi: kneadMembershipABI,
    });

    // Check for premium token FIRST (higher priority)
    const premiumBalance = await balanceOf({
      contract,
      owner: address,
      tokenId: BigInt(PREMIUM_TOKEN_ID),
    });
    if (premiumBalance > 0n) {
      return NextResponse.json({
        membershipType: "premium",
      });
    }

    // Check for freemium token
    const freemiumBalance = await balanceOf({
      contract,
      owner: address,
      tokenId: BigInt(FREEMIUM_TOKEN_ID),
    });
    if (freemiumBalance > 0n) {
      return NextResponse.json({
        membershipType: "freemium",
      });
    }

    // 2. Fallback: Check Supabase for pending subscription
    // (User paid via Stripe but NFT hasn't been minted yet)
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("wallet_address", address.toLowerCase())
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);

    if (subscription && subscription.length > 0) {
      return NextResponse.json({
        membershipType: "premium",
      });
    }

    // 3. No membership found - return "none"
    // The frontend should trigger freemium NFT minting for new users
    return NextResponse.json({ membershipType: "none" });
    
  } catch (error) {
    console.error("Failed to check membership:", error);
    
    // On blockchain errors, return "none" instead of assuming freemium
    // This prevents false positives
    return NextResponse.json({
      membershipType: "none",
      error: "Failed to verify membership"
    }, { status: 500 });
  }
}
