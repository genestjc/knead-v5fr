import { NextRequest } from "next/server";
import Stripe from "stripe";
import {
  getContract,
  prepareContractCall,
  sendTransaction,
  balanceOf,
} from "thirdweb";
import { base } from "thirdweb/chains";
import kneadMembershipABI from "../../abi/kneadMembershipABI.json";
import { createClient } from "@supabase/supabase-js";
import { client, serverWallet } from "../thirdweb-server-wallet";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS as string;
const PAID_TOKEN_ID = 1;

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function hasPremiumNFT(walletAddress: string) {
  try {
    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: base,
      abi: kneadMembershipABI,
    });
    const balance = await balanceOf({
      contract,
      owner: walletAddress,
      tokenId: BigInt(PAID_TOKEN_ID),
    });
    return balance > 0n;
  } catch (error) {
    console.error("Error checking premium NFT:", error);
    return false;
  }
}

async function mintPremiumNFT(walletAddress: string) {
  try {
    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: base,
      abi: kneadMembershipABI,
    });
    if (await hasPremiumNFT(walletAddress)) return;

    const transaction = prepareContractCall({
      contract,
      method: "function mint(address to, uint256 id, uint256 amount)",
      params: [walletAddress, BigInt(PAID_TOKEN_ID), 1n],
    });

    await sendTransaction({
      account: serverWallet,
      transaction,
    });

    // Upsert user status in Supabase
    try {
      await supabase.from("users").upsert(
        {
          wallet_address: walletAddress.toLowerCase(),
          membership_status: "premium",
          updated_at: new Date().toISOString(),
        },
        { onConflict: ["wallet_address"] },
      );
    } catch (dbError) {
      console.error("Failed to update user status in Supabase:", dbError);
    }
  } catch (error) {
    console.error(`Error minting premium NFT to ${walletAddress}:`, error);
    throw error;
  }
}

async function adminBurnPremiumNFT(walletAddress: string) {
  try {
    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: base,
      abi: kneadMembershipABI,
    });
    if (!(await hasPremiumNFT(walletAddress))) return;

    const transaction = prepareContractCall({
      contract,
      method: "function adminBurn(address from, uint256 id, uint256 amount)",
      params: [walletAddress, BigInt(PAID_TOKEN_ID), 1n],
    });

    await sendTransaction({
      account: serverWallet,
      transaction,
    });

    // Upsert user status in Supabase
    try {
      await supabase.from("users").upsert(
        {
          wallet_address: walletAddress.toLowerCase(),
          membership_status: "freemium",
          updated_at: new Date().toISOString(),
        },
        { onConflict: ["wallet_address"] },
      );
    } catch (dbError) {
      console.error("Failed to update user status in Supabase:", dbError);
    }
  } catch (error) {
    console.error(`Error burning premium NFT from ${walletAddress}:`, error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature") as string;
  const rawBody = await req.arrayBuffer();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      Buffer.from(rawBody),
      sig,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error(
      `Webhook signature verification failed: ${(err as Error).message}`,
    );
    return new Response(`Webhook Error: ${(err as Error).message}`, {
      status: 400,
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const wallet =
          session.metadata?.wallet_address || session.metadata?.walletAddress;
        if (!wallet) {
          console.error(
            "No wallet address found in session metadata:",
            session.id,
          );
          return new Response("No wallet address found in session metadata", {
            status: 200,
          });
        }
        console.log(
          `Processing checkout.session.completed for wallet ${wallet}`,
        );
        await mintPremiumNFT(wallet);
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) {
          console.log("No subscription found in invoice, skipping");
          break;
        }
        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription as string,
        );
        const wallet =
          subscription.metadata?.wallet_address ||
          subscription.metadata?.walletAddress;
        if (!wallet) {
          console.error(
            "No wallet address found in subscription metadata:",
            subscription.id,
          );
          break;
        }
        console.log(
          `Processing invoice.payment_succeeded for wallet ${wallet}`,
        );
        await mintPremiumNFT(wallet);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) {
          console.log("No subscription found in failed invoice, skipping");
          break;
        }
        const attemptCount = invoice.attempt_count || 0;
        if (attemptCount < 3) {
          console.log(
            `Payment failed but only attempt #${attemptCount}, not burning NFT yet`,
          );
          break;
        }
        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription as string,
        );
        const wallet =
          subscription.metadata?.wallet_address ||
          subscription.metadata?.walletAddress;
        if (!wallet) {
          console.error(
            "No wallet address found in subscription metadata:",
            subscription.id,
          );
          break;
        }
        console.log(
          `Processing invoice.payment_failed for wallet ${wallet} after ${attemptCount} attempts`,
        );
        await adminBurnPremiumNFT(wallet);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const wallet =
          subscription.metadata?.wallet_address ||
          subscription.metadata?.walletAddress;
        if (!wallet) {
          console.error(
            "No wallet address found in subscription metadata:",
            subscription.id,
          );
          break;
        }
        const currentTimestamp = Math.floor(Date.now() / 1000);
        if (subscription.current_period_end < currentTimestamp) {
          console.log(
            `Processing subscription.deleted for wallet ${wallet} - period ended`,
          );
          await adminBurnPremiumNFT(wallet);
        } else {
          console.log(
            `Subscription canceled but access maintained until ${new Date(
              subscription.current_period_end * 1000,
            )} for wallet: ${wallet}`,
          );
        }
        break;
      }
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const wallet =
          paymentIntent.metadata?.wallet_address ||
          paymentIntent.metadata?.walletAddress;
        if (!wallet) {
          console.log("No wallet address in payment intent metadata, skipping");
          break;
        }
        if (paymentIntent.metadata?.subscription_type === "premium") {
          console.log(`Processing one-time payment for wallet ${wallet}`);
          await mintPremiumNFT(wallet);
        }
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
        break;
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
    });
  } catch (err) {
    console.error(`Error processing webhook: ${(err as Error).message}`);
    return new Response(
      JSON.stringify({
        received: true,
        error: `Error processing webhook: ${(err as Error).message}`,
      }),
      {
        status: 200,
      },
    );
  }
}
