import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { privateKeyToAccount } from "thirdweb/wallets/private-key";
import { getContract, prepareContractCall, sendTransaction } from "thirdweb";
import { base } from "thirdweb/chains";
import { createClient } from "@supabase/supabase-js";

// Mark as dynamic route - required for Next.js API routes that use Request
export const dynamic = 'force-dynamic';

// Initialize stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

// Initialize supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// NFT contract details
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!;
const PAID_TOKEN_ID = 1; // Premium token ID

// Import ABI
import kneadMembershipABI from "@/app/abi/kneadMembershipABI.json";

// Create ThirdWeb client for server operations
const client = {
  secretKey: process.env.THIRDWEB_SECRET_KEY!,
};

export async function POST(req: NextRequest) {
  // Get the webhook signature from headers
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    console.error("No stripe signature found in request headers");
    return NextResponse.json({ error: "No stripe signature" }, { status: 400 });
  }

  try {
    // Get the raw body text
    const rawBody = await req.text();
    console.log("Processing Stripe webhook with signature:", signature.substring(0, 10) + "...");
    console.log("Webhook body length:", rawBody.length);

    // Verify the webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    console.log(`Webhook event type: ${event.type}`);

    // Handle the event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Extract customer wallet address from metadata
      const walletAddress = session.metadata?.walletAddress;
      if (!walletAddress) {
        console.error("No wallet address found in session metadata");
        return NextResponse.json(
          { error: "No wallet address provided" },
          { status: 400 }
        );
      }

      console.log(`Processing subscription for wallet: ${walletAddress}`);
      
      // Save subscription details to database first (even before minting)
      const { data: subscription, error: dbError } = await supabase
        .from("subscriptions")
        .insert({
          wallet_address: walletAddress.toLowerCase(),
          subscription_id: session.subscription as string,
          customer_id: session.customer as string,
          status: "active",
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (dbError) {
        console.error("Database error saving subscription:", dbError);
        // Continue with minting anyway - we can reconcile DB later
      }

      // Set up wallet for minting
      try {
        console.log("Setting up server wallet for minting...");
        const privateKey = process.env.THIRDWEB_PRIVATE_KEY!;
        const serverWallet = privateKeyToAccount(privateKey);

        console.log("Getting contract...");
        const contract = getContract({
          client,
          address: CONTRACT_ADDRESS,
          chain: base,
          abi: kneadMembershipABI,
        });

        console.log(`Preparing to mint premium NFT for ${walletAddress}...`);
        
        // Check if user already has premium token
        try {
          const transaction = prepareContractCall({
            contract,
            method: "function balanceOf(address account, uint256 id) view returns (uint256)",
            params: [walletAddress, BigInt(PAID_TOKEN_ID)],
          });

          const balance = await sendTransaction({
            transaction,
          });

          if (balance > 0n) {
            console.log(`User ${walletAddress} already has premium token, skipping mint`);
            return NextResponse.json({
              success: true,
              message: "User already has premium token",
              alreadyHasToken: true,
            });
          }
        } catch (error) {
          console.error("Error checking token balance:", error);
          // Continue with mint attempt anyway
        }

        // Prepare the mint transaction
        console.log("Preparing mint transaction...");
        const transaction = prepareContractCall({
          contract,
          method: "function mint(address to, uint256 id, uint256 amount)",
          params: [walletAddress, BigInt(PAID_TOKEN_ID), 1n],
        });

        // Execute the mint transaction
        console.log("Sending mint transaction...");
        const transactionResult = await sendTransaction({
          account: serverWallet,
          transaction,
        });

        console.log("NFT mint transaction successful:", transactionResult);

        // Update subscription in database with mint info
        if (subscription) {
          await supabase
            .from("subscriptions")
            .update({
              token_minted: true,
              token_id: PAID_TOKEN_ID,
              mint_transaction_hash: transactionResult.transactionHash,
            })
            .eq("id", subscription.id);
        }

        return NextResponse.json({
          success: true,
          transactionHash: transactionResult.transactionHash,
        });
      } catch (error: any) {
        console.error("Error minting NFT:", error);
        return NextResponse.json(
          {
            error: "Failed to mint NFT",
            details: error.message || String(error),
          },
          { status: 500 }
        );
      }
    } else if (event.type === "customer.subscription.deleted") {
      // Handle subscription cancellation here
      const subscription = event.data.object as Stripe.Subscription;
      // You should implement the code to burn the NFT or mark it as inactive
      
      console.log(`Subscription ${subscription.id} was canceled`);
      return NextResponse.json({ received: true });
    }

    // Return a response for other event types
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Error processing webhook:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
