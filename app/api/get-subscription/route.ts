import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getMembershipType } from "@/lib/membership";
import { createThirdwebClient } from "thirdweb";

// Mark this route as explicitly dynamic
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");
    
    if (!address) {
      return NextResponse.json(
        { error: "Missing wallet address" },
        { status: 400 },
      );
    }
    
    // First check if there's a subscription in the database
    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("subscription_id, status")
      .eq("wallet_address", address.toLowerCase())
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    
    // If we found an active subscription in the database, return it
    if (subscription?.subscription_id) {
      return NextResponse.json({
        subscriptionId: subscription.subscription_id,
        source: "database"
      });
    }
    
    // If no subscription in database, check if they have an NFT
    const membershipType = await getMembershipType(client, address);
    
    // If they have a premium membership but no subscription record,
    // we should handle this gracefully
    if (membershipType === "premium") {
      return NextResponse.json({
        error: "You have an active membership NFT but no associated Stripe subscription. Please contact support to cancel.",
        membershipType: "premium",
        hasNFT: true
      }, { status: 404 });
    }
    
    // No subscription found
    return NextResponse.json(
      { error: "No active subscription found for this wallet" },
      { status: 404 },
    );
  } catch (error: any) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch subscription details" },
      { status: 500 },
    );
  }
}
