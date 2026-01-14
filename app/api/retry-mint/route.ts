import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prepareContractCall, Engine } from "thirdweb";
import { getMembershipContract } from "@/lib/contracts/getters";
import { checkTokenOwnership } from "@/lib/contracts/helpers";
import { createSupabaseAdmin } from "@/lib/supabase/chat-client";
import { client, serverWallet } from "../../../thirdweb-server-wallet";
import { logger } from "@/lib/logger";

// Mark as dynamic
export const dynamic = 'force-dynamic';

// Initialize stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

// NFT contract details
const PAID_TOKEN_ID = 1; // Premium token ID

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, sessionId } = await req.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Missing wallet address" },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing session ID" },
        { status: 400 }
      );
    }

    logger.debug(`Retry mint request for wallet: ${walletAddress}, session: ${sessionId}`);

    // First check if the session is valid
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 400 }
      );
    }

    // Check if wallet address matches
    if (session.metadata?.walletAddress !== walletAddress) {
      return NextResponse.json(
        { error: "Wallet address does not match session" },
        { status: 400 }
      );
    }

    logger.debug("Getting contract...");
    
    // Check if user already has premium token using shared helper
    const { owned, balance } = await checkTokenOwnership(walletAddress, BigInt(PAID_TOKEN_ID));

    if (owned) {
      logger.debug(`User already has premium token, skipping mint`);
      
      // Make sure subscription is marked as minted in DB
      const supabase = createSupabaseAdmin();
      await supabase
        .from("subscriptions")
        .update({
          token_minted: true,
          token_id: PAID_TOKEN_ID,
        })
        .eq("subscription_id", session.subscription)
        .eq("wallet_address", walletAddress.toLowerCase());
        
        return NextResponse.json({
          success: true,
          message: "User already has premium token",
          alreadyHasToken: true,
        });
    }

    // Prepare the mint transaction with explicit gas parameters
    logger.debug("Preparing mint transaction...");
    const contract = getMembershipContract();
    const transaction = prepareContractCall({
      contract,
      method: "function mint(address to, uint256 id, uint256 amount)",
      params: [walletAddress, BigInt(PAID_TOKEN_ID), 1n],
      gasLimit: 300000n,
    });

    // Execute the mint transaction using Engine
    logger.debug("Enqueueing mint transaction...");
    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
    });

    logger.debug(`Waiting for transaction hash (ID: ${transactionId})...`);
    const { transactionHash } = await Engine.waitForTransactionHash({
      client,
      transactionId,
    });

    logger.logTransaction("NFT mint transaction successful", transactionHash);

    // Update subscription in database with mint info
    const supabase = createSupabaseAdmin();
    await supabase
      .from("subscriptions")
      .update({
        token_minted: true,
        token_id: PAID_TOKEN_ID,
        mint_transaction_hash: transactionHash,
      })
      .eq("subscription_id", session.subscription)
      .eq("wallet_address", walletAddress.toLowerCase());

    return NextResponse.json({
      success: true,
      transactionHash,
      transactionId,
    });
  } catch (error: any) {
    logger.error("Error in retry-mint:", error);
    return NextResponse.json(
      {
        error: "Failed to mint NFT",
      },
      { status: 500 }
    );
  }
}
