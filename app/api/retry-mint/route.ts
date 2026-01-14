import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getContract, prepareContractCall, Engine } from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { client, serverWallet, SERVER_WALLET_ADDRESS } from "../../../thirdweb-server-wallet";
import { logger } from "@/lib/logger";

// Mark as dynamic
export const dynamic = 'force-dynamic';

// Initialize stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

// NFT contract details
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!;
const PAID_TOKEN_ID = 1; // Premium token ID

// Import ABI
import kneadMembershipABI from "@/app/abi/kneadMembershipABI.json";

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

    logger.log(`Retry mint request for wallet: ${walletAddress}, session: ${sessionId}`);

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

    // Set up wallet for minting
    logger.log("Setting up server wallet for minting...");
    logger.log("Server wallet address:", SERVER_WALLET_ADDRESS);

    logger.log("Getting contract...");
    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: base,
      abi: kneadMembershipABI,
    });

    logger.log(`Preparing to mint premium NFT for ${walletAddress}...`);
    
    const supabase = getSupabaseAdmin();
    
    // Check if user already has premium token - FIXED PATTERN
    try {
      const balance = await balanceOf({
        contract,
        owner: walletAddress,
        tokenId: BigInt(PAID_TOKEN_ID),
      });

      if (balance > 0n) {
        logger.log(`User ${walletAddress} already has premium token, skipping mint`);
        
        // Make sure subscription is marked as minted in DB
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
    } catch (error) {
      logger.error("Error checking token balance:", error);
      // Continue with mint attempt anyway
    }

    // Prepare the mint transaction with explicit gas parameters
    logger.log("Preparing mint transaction...");
    const transaction = prepareContractCall({
      contract,
      method: "function mint(address to, uint256 id, uint256 amount)",
      params: [walletAddress, BigInt(PAID_TOKEN_ID), 1n],
      gasLimit: 300000n,
    });

    // Execute the mint transaction using Engine
    logger.log("Enqueueing mint transaction...");
    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
    });

    logger.log(`Waiting for transaction hash (ID: ${transactionId})...`);
    const { transactionHash } = await Engine.waitForTransactionHash({
      client,
      transactionId,
    });

    logger.log("NFT mint transaction successful");
    logger.log(`Transaction hash: ${transactionHash}`);
    logger.log(`View on Basescan: https://basescan.org/tx/${transactionHash}`);

    // Update subscription in database with mint info
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
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
