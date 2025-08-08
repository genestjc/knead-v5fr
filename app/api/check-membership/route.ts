import { NextRequest, NextResponse } from "next/server";
import { createThirdwebClient } from "thirdweb";
import { getMembershipType } from "@/lib/membership";
import { createClient } from "@supabase/supabase-js";

// Initialize supabase (to check backup subscription data)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

export const dynamic = 'force-dynamic'; // Ensure route is dynamic

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  
  if (!address)
    return NextResponse.json(
      { error: "Missing address" },
      { status: 400 },
    );

  try {
    // First check our Supabase database for a valid subscription
    // This provides a backup way to verify membership if ThirdWeb is down
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("wallet_address", address.toLowerCase())
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);
    
    // If we find an active subscription in the database, consider them premium
    if (subscription && subscription.length > 0) {
      console.log(`Found active subscription in database for ${address}`);
      return NextResponse.json({ membershipType: "premium" });
    }
    
    // Otherwise, try the ThirdWeb check
    try {
      console.log(`Checking ThirdWeb NFT membership for ${address}`);
      const membershipType = await getMembershipType(
        client,
        address,
      );
      return NextResponse.json({ membershipType });
    } catch (thirdwebError) {
      console.error("ThirdWeb error:", thirdwebError);
      
      // If ThirdWeb fails, check if we have any article reads for this user
      const { data: articleReads } = await supabase
        .from("article_reads")
        .select("*")
        .eq("user_address", address.toLowerCase())
        .limit(1);
      
      // If they've read articles before, they must have at least freemium access
      if (articleReads && articleReads.length > 0) {
        console.log(`Found article reads for user ${address}, defaulting to freemium`);
        return NextResponse.json({ membershipType: "freemium" });
      }
      
      // Last resort - give them freemium to prevent lockout
      return NextResponse.json({ membershipType: "freemium" });
    }
  } catch (error) {
    console.error("Failed to check membership:", error);
    // Default to freemium on any errors - better UX than locking users out
    return NextResponse.json({ membershipType: "freemium" });
  }
}
