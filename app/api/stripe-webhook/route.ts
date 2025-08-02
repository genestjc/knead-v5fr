import { NextRequest } from "next/server";
import Stripe from "stripe";
import { createThirdwebClient, getContract } from "thirdweb";
import { mintTo, balanceOf } from "thirdweb/extensions/erc1155";
import { writeContract } from "thirdweb";
import { base } from "thirdweb/chains";
import kneadMembershipABI from "../../abi/kneadMembershipABI.json";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS as string;
const ADMIN_SECRET = process.env.THIRDWEB_ADMIN_SECRET as string;
const PAID_TOKEN_ID = 1;

const client = createThirdwebClient({ secretKey: ADMIN_SECRET });

async function hasPremiumNFT(walletAddress: string) {
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
}

async function mintPremiumNFT(walletAddress: string) {
  const contract = getContract({
    client,
    address: CONTRACT_ADDRESS,
    chain: base,
    abi: kneadMembershipABI,
  });
  // Idempotency: only mint if not already owned
  if (await hasPremiumNFT(walletAddress)) return;
  await mintTo({
    contract,
    to: walletAddress,
    tokenId: BigInt(PAID_TOKEN_ID),
    amount: 1n,
  });
}

async function adminBurnPremiumNFT(walletAddress: string) {
  const contract = getContract({
    client,
    address: CONTRACT_ADDRESS,
    chain: base,
    abi: kneadMembershipABI,
  });
  // Idempotency: only burn if owned
  if (!(await hasPremiumNFT(walletAddress))) return;
  await writeContract({
    contract,
    method: "adminBurn",
    params: [walletAddress, BigInt(PAID_TOKEN_ID), 1n],
  });
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
        if (wallet) {
          await mintPremiumNFT(wallet);
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscription = invoice.subscription as string;
        const sub = await stripe.subscriptions.retrieve(subscription);
        const wallet =
          sub.metadata?.wallet_address || sub.metadata?.walletAddress;
        if (wallet) {
          await mintPremiumNFT(wallet);
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription as string,
          );
          const wallet =
            subscription.metadata?.wallet_address ||
            subscription.metadata?.walletAddress;
          if (wallet) {
            await adminBurnPremiumNFT(wallet);
            console.log(
              `Payment failed - Premium NFT burned for wallet: ${wallet}`,
            );
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const wallet =
          subscription.metadata?.wallet_address ||
          subscription.metadata?.walletAddress;
        if (wallet) {
          // Only burn if subscription period has ended
          const currentTimestamp = Math.floor(Date.now() / 1000);
          if (subscription.current_period_end < currentTimestamp) {
            await adminBurnPremiumNFT(wallet);
            console.log(
              `Subscription ended - Premium NFT burned for wallet: ${wallet}`,
            );
          } else {
            console.log(
              `Subscription canceled but access maintained until ${new Date(
                subscription.current_period_end * 1000,
              )} for wallet: ${wallet}`,
            );
          }
        }
        break;
      }
      case "payment_intent.succeeded": {
        // Only mint if this is a one-off premium purchase (not subscription)
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const wallet =
          paymentIntent.metadata?.wallet_address ||
          paymentIntent.metadata?.walletAddress;
        if (paymentIntent.metadata?.subscription_type === "premium" && wallet) {
          await mintPremiumNFT(wallet);
        }
        break;
      }
      case "payment_intent.payment_failed": {
        // No NFT action needed, but log for audit
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const wallet =
          paymentIntent.metadata?.wallet_address ||
          paymentIntent.metadata?.walletAddress;
        if (wallet) {
          console.log(`Payment failed for wallet: ${wallet}`);
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
    // Always return 200 to Stripe to avoid retries, but log error
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
