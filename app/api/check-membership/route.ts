import { NextRequest, NextResponse } from "next/server";
import {
  createThirdwebClient,
  getContract,
} from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";
import kneadMembershipABI from "@/abi/kneadMembershipABI.json";
import { createClient } from "@supabase/supabase-js";

// Constants
const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!;
const FREEMIUM_TOKEN_ID = 0; // Update if you have other token IDs for premium

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Initialize thirdweb client
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
    // 1. Check ERC1155 contract for freemium token
    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: base,
      abi: kneadMembershipABI,
    });

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

    // TODO: Add premium token check here if you have a premium tokenId
    // const premiumBalance = await balanceOf({ ... });
    // if (premiumBalance > 0n) return NextResponse.json({ membershipType: "premium" });

    // 2. Fallback: Check Supabase for active subscription
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

    // 3. Fallback: Check for article reads (freemium)
    const { data: articleReads } = await supabase
      .from("article_reads")
      .select("*")
      .eq("user_address", address.toLowerCase())
      .limit(1);

    if (articleReads && articleReads.length > 0) {
      return NextResponse.json({
        membershipType: "freemium",
      });
    }

    // 4. Default: No membership found
    return NextResponse.json({ membershipType: "none" });
  } catch (error) {
    console.error("Failed to check membership:", error);
    // Default to freemium on any errors for better UX
    return NextResponse.json({
      membershipType: "freemium",
    });
  }
}
