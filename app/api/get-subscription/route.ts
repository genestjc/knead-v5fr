import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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
    
    // Query your subscriptions table to find the active subscription
    const { data, error } = await supabase
      .from("subscriptions")
      .select("subscription_id")
      .eq("wallet_address", address.toLowerCase())
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      return NextResponse.json(
        { error: "No active subscription found for this wallet" },
        { status: 404 },
      );
    }
    
    return NextResponse.json({
      subscriptionId: data.subscription_id
    });
  } catch (error: any) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch subscription details" },
      { status: 500 },
    );
  }
}
