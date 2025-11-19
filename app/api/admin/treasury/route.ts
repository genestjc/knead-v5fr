import { NextRequest, NextResponse } from "next/server";
import { getTreasuryBalance, getTreasuryAddress } from "@/lib/thirdweb/treasury";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminId = searchParams.get("adminId");

    // Basic admin authentication (improve this in production)
    if (!adminId || adminId !== process.env.ADMIN_SECRET_KEY) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get treasury wallet address
    const treasuryAddress = getTreasuryAddress();

    // Get treasury balance
    const balance = await getTreasuryBalance();

    // Get pending claims from database
    const { data: pendingClaims, error: claimsError } = await supabase
      .from("earnings")
      .select("amount")
      .eq("status", "pending");

    if (claimsError) {
      console.error("Error fetching pending claims:", claimsError);
    }

    const totalPendingClaims = pendingClaims?.reduce(
      (sum, claim) => sum + parseFloat(claim.amount),
      0
    ) || 0;

    // Get total earnings owed
    const { data: earnings, error: earningsError } = await supabase
      .from("earnings")
      .select("amount")
      .eq("claimed", false);

    if (earningsError) {
      console.error("Error fetching earnings:", earningsError);
    }

    const totalEarningsOwed = earnings?.reduce(
      (sum, earning) => sum + parseFloat(earning.amount),
      0
    ) || 0;

    const balanceNum = parseFloat(balance);
    const isHealthy = balanceNum > totalEarningsOwed;

    return NextResponse.json({
      success: true,
      data: {
        treasuryAddress,
        balance,
        pendingClaims: totalPendingClaims,
        totalEarningsOwed,
        isHealthy,
      },
    });
  } catch (error: any) {
    console.error("Treasury API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch treasury data",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
