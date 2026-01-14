import { NextRequest, NextResponse } from "next/server";
import { prepareContractCall, Engine } from "thirdweb";
import { getMembershipContract } from "@/lib/contracts/getters";
import { checkTokenOwnership } from "@/lib/contracts/helpers";
import { verifyVipToken } from "@/lib/verify-vip-token";
import { createSupabaseAdmin } from "@/lib/supabase/chat-client";
import { client, serverWallet } from "../../../thirdweb-server-wallet";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 },
      );
    }

    const token = authHeader.substring(7);
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

    if (!/^0x[a-fA-F0-9]{40}$/.test(user_address)) {
      return NextResponse.json(
        { error: "Invalid wallet address format" },
        { status: 400 },
      );
    }

    // Use shared helper to check token ownership
    const { owned } = await checkTokenOwnership(user_address, 1n);

    if (owned) {
      return NextResponse.json({
        success: true,
        alreadyMinted: true,
        message: "User already has a premium membership",
      });
    }

    const contract = getMembershipContract();

    const transaction = prepareContractCall({
      contract,
      method: "function mint(address to, uint256 id, uint256 amount)",
      params: [user_address, 1n, 1n],
      gasLimit: 300000n,
    });

    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
    });

    const { transactionHash } = await Engine.waitForTransactionHash({
      client,
      transactionId,
    });

    if (email) {
      const supabase = createSupabaseAdmin();
      await supabase.from("users").upsert(
        {
          wallet_address: user_address.toLowerCase(),
          email: email,
          membership_status: "premium",
          membership_type: "vip",
          created_at: new Date().toISOString(),
        },
        { onConflict: ["wallet_address"] },
      );
    }

    return NextResponse.json({
      success: true,
      transactionHash,
      transactionId,
      message: "VIP membership minted successfully",
    });
  } catch (error) {
    logger.error("VIP mint error:", error);
    return NextResponse.json(
      { error: "Failed to mint VIP token" },
      { status: 500 },
    );
  }
}
