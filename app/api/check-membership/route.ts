import { NextRequest, NextResponse } from "next/server";
import { createThirdwebClient } from "thirdweb";
import { checkMembershipType } from "@/lib/contracts/helpers";
import { createSupabaseAdmin } from "@/lib/supabase/chat-client";
import { logger } from "@/lib/logger";

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
    // 1. Check ERC1155 contract (PRIMARY source of truth) - parallelized internally
    const membershipType = await checkMembershipType(address);
    
    if (membershipType) {
      return NextResponse.json({ membershipType });
    }

    // 2. Fallback: Check Supabase for pending subscription
    // (User paid via Stripe but NFT hasn't been minted yet)
    const supabase = createSupabaseAdmin();
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
    logger.error("Failed to check membership:", error);
    
    // On blockchain errors, return "none" instead of assuming freemium
    // This prevents false positives
    return NextResponse.json({
      membershipType: "none",
      error: "Failed to verify membership"
    }, { status: 500 });
  }
}
