import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { sendEmail } from "@/lib/sendEmail";
import { cancellationEmail } from "@/lib/emailTemplates";
import {
  getContract,
  prepareContractCall,
  Engine,
} from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";
import { createClient } from "@supabase/supabase-js";
import { verifyWalletRequest } from "@/lib/auth/verify-wallet-request";
import {
  client,
  serverWallet,
} from "../../../thirdweb-server-wallet";
import kneadMembershipABI from "../../abi/kneadMembershipABI.json";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});

// Initialize supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// NFT contract details
const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!;
const PREMIUM_TOKEN_ID = 1n; // Use bigint for consistency

export async function POST(req: NextRequest) {
  try {
    // Authenticate: cancelling a subscription (and burning the membership NFT)
    // is a sensitive action. Require a wallet signature so someone who merely
    // knows a subscription ID can't cancel another member's plan.
    const auth = await verifyWalletRequest(req);
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error ?? "Unauthorized" },
        { status: auth.status ?? 401 },
      );
    }

    const { user_address, email, subscriptionId } =
      await req.json();

    if (!user_address || !subscriptionId) {
      return NextResponse.json(
        { error: "Missing user_address or subscriptionId" },
        { status: 400 },
      );
    }

    // You may only cancel your own membership.
    if (user_address.toLowerCase() !== auth.address) {
      return NextResponse.json(
        { error: "Wallet address does not match the authenticated signer" },
        { status: 403 },
      );
    }

    console.log(
      `Processing cancellation for ${user_address}, subscription ${subscriptionId}`,
    );

    // First check if subscription still exists and is active
    try {
      const subscription =
        await stripe.subscriptions.retrieve(subscriptionId);
      if (subscription.status === "canceled") {
        return NextResponse.json(
          { message: "Subscription already cancelled" },
          { status: 200 },
        );
      }

      // Confirm this subscription actually belongs to the authenticated wallet.
      // Prefer Stripe metadata; fall back to our own subscriptions table. If we
      // can't positively confirm ownership, refuse — never default to allowing
      // the cancel (the old behaviour let a subscription with no wallet metadata
      // be cancelled by anyone who knew its ID).
      let ownerWallet =
        subscription.metadata?.wallet_address ||
        subscription.metadata?.walletAddress ||
        null;

      if (!ownerWallet) {
        const { data: subRow } = await supabase
          .from("subscriptions")
          .select("wallet_address")
          .eq("subscription_id", subscriptionId)
          .single();
        ownerWallet = subRow?.wallet_address ?? null;
      }

      if (!ownerWallet || ownerWallet.toLowerCase() !== user_address.toLowerCase()) {
        return NextResponse.json(
          {
            error:
              "This subscription does not belong to the provided wallet address",
          },
          { status: 403 },
        );
      }

      // 1. Cancel the Stripe subscription at period end
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
        metadata: {
          cancellation_reason: "user_requested",
          cancelled_at: new Date().toISOString(),
        },
      });

      // For immediate cancellation, we would burn the NFT now
      // For period-end cancellation, NFT will be burned when subscription actually ends
      const shouldBurnNow = false; // Change to true if you want to burn immediately

      if (shouldBurnNow) {
        try {
          console.log(
            "Burning NFT for immediate cancellation",
          );

          const contract = getContract({
            client,
            address: CONTRACT_ADDRESS,
            chain: base,
            abi: kneadMembershipABI,
          });

          // Check if user has premium token
          const balance = await balanceOf({
            contract,
            owner: user_address,
            tokenId: PREMIUM_TOKEN_ID,
          });

          if (balance > 0n) {
            console.log(
              `User ${user_address} has premium token, burning it`,
            );

            const transaction = prepareContractCall({
              contract,
              method:
                "function adminBurn(address from, uint256 id, uint256 amount)",
              params: [user_address, PREMIUM_TOKEN_ID, 1n],
              gasLimit: 300000n,
            });

            const { transactionId } = await serverWallet.enqueueTransaction({
              transaction,
            });

            const { transactionHash } = await Engine.waitForTransactionHash({
              client,
              transactionId,
            });

            console.log(
              `NFT burned successfully: ${transactionHash}`,
            );
          } else {
            console.log(
              `User ${user_address} doesn't have premium token, nothing to burn`,
            );
          }
        } catch (burnError) {
          console.error("Error burning NFT:", burnError);
          // Continue even if burning fails - we can retry later
        }
      }

      // Update subscription status in database
      await supabase
        .from("subscriptions")
        .update({
          status: shouldBurnNow
            ? "cancelled"
            : "cancelling",
          updated_at: new Date().toISOString(),
        })
        .eq("subscription_id", subscriptionId)
        .eq("wallet_address", user_address.toLowerCase());

      // 2. Send cancellation email if provided
      if (email) {
        try {
          await sendEmail({
            to: email,
            subject: "We're sorry to see you go.",
            html: cancellationEmail(),
          });
        } catch (emailErr) {
          console.error(
            "Failed to send cancellation email:",
            emailErr,
          );
          // Continue even if email fails
        }
      }

      return NextResponse.json({
        success: true,
        message:
          "Subscription cancelled. Your access will remain active until the end of your current billing period.",
      });
    } catch (err: any) {
      if (err.code === "resource_missing") {
        return NextResponse.json(
          { error: "Subscription not found" },
          { status: 404 },
        );
      }
      throw err; // Re-throw unexpected errors
    }
  } catch (error: any) {
    console.error("Cancellation error:", error);
    return NextResponse.json(
      {
        error:
          error.message || "An unexpected error occurred",
      },
      { status: 500 },
    );
  }
}
