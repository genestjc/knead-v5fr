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
    const adminAddress = searchParams.get("adminAddress");

    if (!adminAddress) {
      return NextResponse.json(
        { error: "Missing adminAddress parameter" },
        { status: 400 }
      );
    }

    // Verify admin permissions
    const { data: adminUser, error: adminError } = await supabase
      .from("chat_users")
      .select("role")
      .eq("address", adminAddress.toLowerCase())
      .single();

    if (adminError || !adminUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (adminUser.role !== 'admin' && adminUser.role !== 'master-admin') {
      return NextResponse.json(
        { error: "Insufficient permissions - admin only" },
        { status: 403 }
      );
    }

    // Get treasury wallet address
    const treasuryAddress = getTreasuryAddress();

    // Get treasury balance
    const balance = await getTreasuryBalance();

    // Get pending withdrawal requests from towns_claim_requests
    const { data: pendingClaims, error: claimsError } = await supabase
      .from("towns_claim_requests")
      .select(`
        *,
        chat_users!user_id (
          id,
          address,
          display_name,
          alias
        )
      `)
      .eq("status", "pending")
      .order("requested_at", { ascending: false });

    if (claimsError) {
      console.error("Error fetching pending claims:", claimsError);
    }

    const formattedClaims = (pendingClaims || []).map((claim) => ({
      id: claim.id,
      userId: claim.user_id,
      amount: claim.amount,
      status: claim.status,
      requestedAt: claim.requested_at,
      user: {
        id: claim.chat_users?.id,
        address: claim.chat_users?.address,
        displayName: claim.chat_users?.alias || claim.chat_users?.display_name,
      },
    }));

    const totalPendingClaims = formattedClaims.reduce(
      (sum, claim) => sum + parseFloat(claim.amount.toString()),
      0
    );

    // Get completed transactions for history
    const { data: completedClaims } = await supabase
      .from("towns_claim_requests")
      .select(`
        *,
        chat_users!user_id (
          display_name,
          alias
        )
      `)
      .in("status", ["completed", "rejected"])
      .order("processed_at", { ascending: false })
      .limit(50);

    const transactionHistory = (completedClaims || []).map((claim) => ({
      id: claim.id,
      amount: claim.amount,
      status: claim.status,
      requestedAt: claim.requested_at,
      processedAt: claim.processed_at,
      txHash: claim.tx_hash,
      userName: claim.chat_users?.alias || claim.chat_users?.display_name,
    }));

    const balanceNum = parseFloat(balance);
    const isHealthy = balanceNum > totalPendingClaims;

    return NextResponse.json({
      success: true,
      data: {
        treasuryAddress,
        balance,
        pendingClaims: formattedClaims,
        totalPendingAmount: totalPendingClaims,
        transactionHistory,
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

/**
 * POST /api/admin/treasury
 * Approve or deny a withdrawal request (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminAddress, claimId, action, notes } = body;

    if (!adminAddress || !claimId || !action) {
      return NextResponse.json(
        { error: "Missing required fields: adminAddress, claimId, action" },
        { status: 400 }
      );
    }

    const validActions = ['approve', 'reject'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify admin permissions
    const { data: adminUser, error: adminError } = await supabase
      .from("chat_users")
      .select("role, id")
      .eq("address", adminAddress.toLowerCase())
      .single();

    if (adminError || !adminUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (adminUser.role !== 'admin' && adminUser.role !== 'master-admin') {
      return NextResponse.json(
        { error: "Insufficient permissions - admin only" },
        { status: 403 }
      );
    }

    // Get the claim request
    const { data: claim, error: claimError } = await supabase
      .from("towns_claim_requests")
      .select("*")
      .eq("id", claimId)
      .single();

    if (claimError || !claim) {
      return NextResponse.json(
        { error: "Claim request not found" },
        { status: 404 }
      );
    }

    if (claim.status !== 'pending') {
      return NextResponse.json(
        { error: "Claim has already been processed" },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      // Update status to processing, then handle the transfer
      // Note: Actual transfer would be handled by a separate service/cron job
      // that watches for 'approved' status and processes the transaction
      const { error: updateError } = await supabase
        .from("towns_claim_requests")
        .update({
          status: "approved",
          processed_at: new Date().toISOString(),
          notes: notes || null,
        })
        .eq("id", claimId);

      if (updateError) {
        console.error("Error approving claim:", updateError);
        return NextResponse.json(
          { error: "Failed to approve claim" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Withdrawal approved and will be processed shortly",
      });
    } else {
      // Reject the claim
      const { error: updateError } = await supabase
        .from("towns_claim_requests")
        .update({
          status: "rejected",
          processed_at: new Date().toISOString(),
          notes: notes || null,
        })
        .eq("id", claimId);

      if (updateError) {
        console.error("Error rejecting claim:", updateError);
        return NextResponse.json(
          { error: "Failed to reject claim" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Withdrawal request rejected",
      });
    }
  } catch (error: any) {
    console.error("Treasury API error:", error);
    return NextResponse.json(
      {
        error: "Failed to process request",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
