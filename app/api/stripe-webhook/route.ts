import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getContract,
  prepareContractCall,
  Engine,
} from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";
import { createClient } from "@supabase/supabase-js";
import {
  client,
  serverWallet,
} from "../../../thirdweb-server-wallet";
import kneadMembershipABI from "@/app/abi/kneadMembershipABI.json";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const CONTRACT_ADDRESS =
  process.env. NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!;
const PAID_TOKEN_ID = 1n;

async function mintPremiumNFT(
  walletAddress:  string,
  subscriptionId?:  string,
  customerId?: string,
) {
  const contract = getContract({
    client,
    address: CONTRACT_ADDRESS,
    chain: base,
    abi: kneadMembershipABI,
  });

  // Check if user already has premium token
  const balance = await balanceOf({
    contract,
    owner: walletAddress,
    tokenId: PAID_TOKEN_ID,
  });

  if (balance > 0n) {
    return { alreadyHasToken: true };
  }

  // Prepare and send mint transaction
  const transaction = prepareContractCall({
    contract,
    method: 
      "function mint(address to, uint256 id, uint256 amount)",
    params: [walletAddress, PAID_TOKEN_ID, 1n],
    gasLimit: 300000n,
  });

  const { transactionId } = await serverWallet.enqueueTransaction({
    transaction,
  });

  const { transactionHash } = await Engine.waitForTransactionHash({
    client,
    transactionId,
  });

  // Update subscription in database with mint info
  if (subscriptionId) {
    await supabase
      .from("subscriptions")
      .update({
        token_minted: true,
        token_id: PAID_TOKEN_ID. toString(),
        mint_transaction_hash: transactionHash,
      })
      .eq("subscription_id", subscriptionId);
  }

  return {
    transactionHash,
    transactionId,
    token_id: PAID_TOKEN_ID.toString(),
  };
}

async function burnPremiumNFT(
  walletAddress: string,
  subscriptionId?:  string,
) {
  const contract = getContract({
    client,
    address: CONTRACT_ADDRESS,
    chain: base,
    abi:  kneadMembershipABI,
  });

  // Check if user has premium token
  const balance = await balanceOf({
    contract,
    owner: walletAddress,
    tokenId:  PAID_TOKEN_ID,
  });

  if (!balance || balance === 0n) {
    return { 
      success: true, 
      noTokenToBurn: true,
      message: "No premium token to burn" 
    };
  }

  // Prepare and send burn transaction
  const transaction = prepareContractCall({
    contract,
    method:
      "function adminBurn(address from, uint256 id, uint256 amount)",
    params: [walletAddress, PAID_TOKEN_ID, 1n],
    gasLimit: 300000n,
  });

  const { transactionId } = await serverWallet.enqueueTransaction({
    transaction,
  });

  const { transactionHash } = await Engine.waitForTransactionHash({
    client,
    transactionId,
  });

  // Update subscription in database with burn info
  if (subscriptionId) {
    try {
      const { error } = await supabase
        .from("subscriptions")
        .update({
          token_burned: true,
          burn_transaction_hash: transactionHash,
        })
        .eq("subscription_id", subscriptionId);
      
      if (error) {
        console.error(
          `Database error updating burn info for subscription ${subscriptionId}: `,
          error,
        );
      }
    } catch (dbError) {
      // Log database error but still return the transaction result
      console.error(
        `Failed to update database with burn info for subscription ${subscriptionId}:`,
        dbError,
      );
    }
  }

  return {
    success: true,
    transactionHash,
    transactionId,
    token_id: PAID_TOKEN_ID.toString(),
  };
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "No stripe signature" },
      { status: 400 },
    );
  }

  try {
    const rawBody = await req.text();
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err:  any) {
      return NextResponse.json(
        { error: err.message },
        { status: 400 },
      );
    }

    // --- Handle invoice. payment_succeeded (for subscriptions with Stripe Elements) ---
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      
      console.log("=== INVOICE PAYMENT SUCCEEDED ===");
      console.log("Invoice ID:", invoice.id);
      console.log("Billing reason:", invoice.billing_reason);
      
      // Get subscription ID from EITHER location (old API or new API)
      let subscriptionId:  string | undefined;
      
      // Try old API format (top-level subscription field)
      if (invoice.subscription && typeof invoice.subscription === 'string') {
        subscriptionId = invoice.subscription;
        console.log("Found subscription ID (old format):", subscriptionId);
      } 
      // Try new API format (parent.subscription_details.subscription)
      else if ((invoice as any).parent?.subscription_details?.subscription) {
        subscriptionId = (invoice as any).parent.subscription_details. subscription;
        console.log("Found subscription ID (new format):", subscriptionId);
      }
      
      if (! subscriptionId) {
        console.log("⚠️ No subscription ID found - skipping");
        return NextResponse.json({ received: true });
      }
      
      console.log("Processing subscription:", subscriptionId);
      
      // Get wallet address - try multiple locations
      let walletAddress: string | undefined;
      
      // First try: subscription metadata
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        walletAddress = subscription.metadata?.walletAddress;
        console.log("Wallet from subscription metadata:", walletAddress);
      } catch (err) {
        console.error("Error retrieving subscription:", err);
      }
      
      // Second try: invoice parent metadata (new API format)
      if (!walletAddress) {
        walletAddress = (invoice as any).parent?.subscription_details?.metadata?.walletAddress;
        console.log("Wallet from invoice parent metadata:", walletAddress);
      }
      
      // Third try: customer metadata
      if (!walletAddress && invoice.customer) {
        const customer = await stripe.customers.retrieve(invoice.customer as string);
        if (typeof customer !== "string") {
          walletAddress = customer.metadata?.walletAddress;
          console.log("Wallet from customer metadata:", walletAddress);
        }
      }
      
      if (!walletAddress) {
        console.error("❌ No wallet address found!");
        return NextResponse.json(
          { error: "No wallet address found" },
          { status:  400 }
        );
      }
      
      console.log("✅ Found wallet address:", walletAddress);
      
      // Save subscription to database
      await supabase.from("subscriptions").upsert(
        {
          wallet_address: walletAddress. toLowerCase(),
          subscription_id:  subscriptionId,
          customer_id: invoice.customer as string,
          status: "active",
          created_at: new Date().toISOString(),
        },
        { onConflict:  "subscription_id" }
      );
      
      console.log("💎 Minting NFT...");
      
      // Mint NFT
      const mintResult = await mintPremiumNFT(
        walletAddress,
        subscriptionId,
        invoice.customer as string
      );
      
      console.log("✅ Mint result:", JSON.stringify(mintResult));
      
      return NextResponse.json({
        success: true,
        ... mintResult,
      });
    }

    // --- Handle subscription cancellation ---
    if (event. type === "customer.subscription.deleted") {
      const subscription = event.data
        .object as Stripe. Subscription;
      const subscriptionId = subscription.id;
      let walletAddress =
        subscription.metadata?.walletAddress;

      // Fallback:  try to get from DB
      if (!walletAddress) {
        const { data } = await supabase
          .from("subscriptions")
          .select("wallet_address")
          .eq("subscription_id", subscriptionId)
          .single();
        walletAddress = data?.wallet_address;
      }

      console.log(
        `Subscription deleted: ${subscriptionId}, wallet:  ${walletAddress}`
      );

      // Update subscription status in database
      await supabase
        .from("subscriptions")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("subscription_id", subscriptionId);

      // Burn NFT if wallet address is available
      if (walletAddress) {
        try {
          console.log(
            `Attempting to burn NFT for wallet: ${walletAddress}`,
          );
          const burnResult = await burnPremiumNFT(
            walletAddress,
            subscriptionId,
          );
          console.log(
            `NFT burn result: `,
            JSON.stringify(burnResult),
          );
        } catch (error) {
          // Log error but continue - don't fail the webhook
          console.error(
            `Failed to burn NFT for subscription ${subscriptionId}:`,
            error,
          );
        }
      } else {
        console.warn(
          `No wallet address found for subscription ${subscriptionId}, skipping NFT burn`,
        );
      }

      return NextResponse.json({ received: true });
    }

    // --- Handle payment failures ---
    if (event.type === "invoice.payment_failed") {
      const invoice = event. data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;
      
      console. warn(
        `Payment failed for subscription:  ${subscriptionId}`
      );
      
      // Optionally:  Update subscription status or notify user
      // For now, just log it - Stripe will retry automatically
      
      return NextResponse.json({ received: true });
    }

    // Return a response for other event types
    console.log(`Received unhandled webhook event: ${event.type}`);
    return NextResponse.json({ received: true });
  } catch (err:  any) {
    console.error("Webhook handler error:", err);
    return NextResponse.json(
      {
        error: "Webhook handler failed",
        details: err?. message || String(err),
      },
      { status: 500 },
    );
  }
}
