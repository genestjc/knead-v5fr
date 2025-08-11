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
import kneadMembershipABI from "@/app/abi/kneadMembershipABI.json";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!;
const PAID_TOKEN_ID = 1n;

async function mintPremiumNFT(
  walletAddress: string,
  subscriptionId?: string,
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

  if (balance.value > 0n) {
    return { alreadyHasToken: true };
  }

  // Prepare and send mint transaction
  const transaction = prepareContractCall({
    contract,
    method:
      "function mint(address to, uint256 id, uint256 amount)",
    params: [walletAddress, PAID_TOKEN_ID, 1n],
  });

  const transactionResult = await sendTransaction({
    account: serverWallet,
    transaction,
    gasLimit: 300000n,
  });

  // Update subscription in database with mint info
  if (subscriptionId) {
    await supabase
      .from("subscriptions")
      .update({
        token_minted: true,
        token_id: PAID_TOKEN_ID,
        mint_transaction_hash:
          transactionResult.transactionHash,
      })
      .eq("subscription_id", subscriptionId);
  }

  return {
    transactionHash: transactionResult.transactionHash,
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
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message },
        { status: 400 },
      );
    }

    // --- Handle checkout.session.completed (for one-time payments) ---
    if (event.type === "checkout.session.completed") {
      const session = event.data
        .object as Stripe.Checkout.Session;
      const walletAddress = session.metadata?.walletAddress;
      if (!walletAddress) {
        return NextResponse.json(
          { error: "No wallet address provided" },
          { status: 400 },
        );
      }

      // Save subscription details to database
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

      // Mint NFT
      const mintResult = await mintPremiumNFT(
        walletAddress,
        session.subscription as string,
        session.customer as string,
      );
      return NextResponse.json({
        success: true,
        ...mintResult,
      });
    }

    // --- Handle invoice.payment_succeeded (for subscriptions) ---
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;
      let walletAddress: string | undefined;

      // Try to get wallet address from subscription metadata
      if (invoice.subscription) {
        const subscription =
          await stripe.subscriptions.retrieve(
            subscriptionId,
          );
        walletAddress =
          subscription.metadata?.walletAddress;
      }

      // Fallback: try to get from customer metadata
      if (!walletAddress && invoice.customer) {
        const customer = await stripe.customers.retrieve(
          invoice.customer as string,
        );
        if (typeof customer !== "string") {
          walletAddress = customer.metadata?.walletAddress;
        }
      }

      if (!walletAddress) {
        return NextResponse.json(
          {
            error:
              "No wallet address found in subscription/customer metadata",
          },
          { status: 400 },
        );
      }

      // Save subscription details to database (if not already present)
      await supabase.from("subscriptions").upsert(
        {
          wallet_address: walletAddress.toLowerCase(),
          subscription_id: subscriptionId,
          customer_id: invoice.customer as string,
          status: "active",
          created_at: new Date().toISOString(),
        },
        { onConflict: ["subscription_id"] },
      );

      // Mint NFT
      const mintResult = await mintPremiumNFT(
        walletAddress,
        subscriptionId,
        invoice.customer as string,
      );
      return NextResponse.json({
        success: true,
        ...mintResult,
      });
    }

    // --- Handle subscription cancellation ---
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data
        .object as Stripe.Subscription;
      const subscriptionId = subscription.id;
      let walletAddress =
        subscription.metadata?.walletAddress;

      // Fallback: try to get from DB
      if (!walletAddress) {
        const { data } = await supabase
          .from("subscriptions")
          .select("wallet_address")
          .eq("subscription_id", subscriptionId)
          .single();
        walletAddress = data?.wallet_address;
      }

      // Update subscription status in database
      await supabase
        .from("subscriptions")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("subscription_id", subscriptionId);

      return NextResponse.json({ received: true });
    }

    // Return a response for other event types
    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Webhook handler failed",
        details: err?.message || String(err),
      },
      { status: 500 },
    );
  }
}
