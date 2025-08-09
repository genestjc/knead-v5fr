import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getContract,
  prepareContractCall,
  sendTransaction,
} from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";
import { createClient } from "@supabase/supabase-js";
import {
  client,
  serverWallet,
} from "../../../thirdweb-server-wallet";

// Mark as dynamic route - required for Next.js API routes that use Request
export const dynamic = "force-dynamic";

// Initialize stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

// Initialize supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// NFT contract details
const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!;
const PAID_TOKEN_ID = 1n; // Premium token ID as bigint

// Import ABI
import kneadMembershipABI from "@/app/abi/kneadMembershipABI.json";

export async function POST(req: NextRequest) {
  // Get the webhook signature from headers
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    console.error(
      "No stripe signature found in request headers",
    );
    return NextResponse.json(
      { error: "No stripe signature" },
      { status: 400 },
    );
  }

  try {
    // Get the raw body text
    const rawBody = await req.text();
    console.log(
      "Processing Stripe webhook with signature:",
      signature.substring(0, 10) + "...",
    );
    console.log("Webhook body length:", rawBody.length);

    // Verify the webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err: any) {
      console.error(
        `Webhook signature verification failed: ${err.message}`,
      );
      return NextResponse.json(
        { error: err.message },
        { status: 400 },
      );
    }

    console.log(`Webhook event type: ${event.type}`);

    // Handle the event
    if (event.type === "checkout.session.completed") {
      const session = event.data
        .object as Stripe.Checkout.Session;

      // Extract customer wallet address from metadata
      const walletAddress = session.metadata?.walletAddress;
      if (!walletAddress) {
        console.error(
          "No wallet address found in session metadata",
        );
        return NextResponse.json(
          { error: "No wallet address provided" },
          { status: 400 },
        );
      }

      console.log(
        `Processing subscription for wallet: ${walletAddress}`,
      );

      // Save subscription details to database first (even before minting)
      const { data: subscription, error: dbError } =
        await supabase
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
        console.error(
          "Database error saving subscription:",
          dbError,
        );
        // Continue with minting anyway - we can reconcile DB later
      }

      // Set up wallet for minting
      try {
        console.log("Getting contract...");
        const contract = getContract({
          client,
          address: CONTRACT_ADDRESS,
          chain: base,
          abi: kneadMembershipABI,
        });

        console.log(
          `Preparing to mint premium NFT for ${walletAddress}...`,
        );

        // Check if user already has premium token
        try {
          const balance = await balanceOf({
            contract,
            owner: walletAddress,
            tokenId: PAID_TOKEN_ID,
          });

          if (balance.value > 0n) {
            console.log(
              `User ${walletAddress} already has premium token, skipping mint`,
            );
            return NextResponse.json({
              success: true,
              message: "User already has premium token",
              alreadyHasToken: true,
            });
          }
        } catch (error) {
          console.error(
            "Error checking token balance:",
            error,
          );
          // Continue with mint attempt anyway
        }

        // Prepare the mint transaction
        console.log("Preparing mint transaction...");
        const transaction = prepareContractCall({
          contract,
          method:
            "function mint(address to, uint256 id, uint256 amount)",
          params: [walletAddress, PAID_TOKEN_ID, 1n],
        });

        // Execute the mint transaction
        console.log("Sending mint transaction...");
        const transactionResult = await sendTransaction({
          account: serverWallet,
          transaction,
          gasLimit: 300000n, // Optional: adjust as needed
        });

        console.log(
          "NFT mint transaction successful:",
          transactionResult,
        );
        console.log(
          `Transaction hash: ${transactionResult.transactionHash}`,
        );
        console.log(
          `View on Basescan: https://basescan.org/tx/${transactionResult.transactionHash}`,
        );

        // Update subscription in database with mint info
        if (subscription) {
          await supabase
            .from("subscriptions")
            .update({
              token_minted: true,
              token_id: PAID_TOKEN_ID,
              mint_transaction_hash:
                transactionResult.transactionHash,
            })
            .eq("id", subscription.id);
        }

        return NextResponse.json({
          success: true,
          transactionHash:
            transactionResult.transactionHash,
        });
      } catch (error: any) {
        console.error("Error minting NFT:", error);
        return NextResponse.json(
          {
            error: "Failed to mint NFT",
            details: error.message || String(error),
          },
          { status: 500 },
        );
      }
    } else if (
      event.type === "customer.subscription.deleted"
    ) {
      // Handle subscription cancellation here
      const subscription = event.data
        .object as Stripe.Subscription;

      // Get wallet address from metadata or database
      const walletAddress =
        subscription.metadata?.walletAddress;
      if (!walletAddress) {
        // Try to get wallet address from the database
        const { data } = await supabase
          .from("subscriptions")
          .select("wallet_address")
          .eq("subscription_id", subscription.id)
          .single();

        if (!data?.wallet_address) {
          console.error(
            "Could not find wallet address for cancelled subscription:",
            subscription.id,
          );
          return NextResponse.json({ received: true });
        }

        // Implement NFT burning code here (or call separate endpoint)
        // This is commented out since it requires additional implementation
        /*
        try {
          const result = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/burn-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress: data.wallet_address, tokenId: PAID_TOKEN_ID })
          });
          console.log("Burn result:", await result.json());
        } catch (err) {
          console.error("Error burning token:", err);
        }
        */

        // Update subscription status in database
        await supabase
          .from("subscriptions")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("subscription_id", subscription.id);
      }

      console.log(
        `Subscription ${subscription.id} was canceled`,
      );
      return NextResponse.json({ received: true });
    }

    // Return a response for other event types
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Error processing webhook:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}
