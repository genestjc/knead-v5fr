import { NextRequest } from "next/server";
import Stripe from "stripe";
import { createThirdwebClient, getContract, writeContract } from "thirdweb";
import { mintTo } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";
import kneadMembershipABI from "../../abi/kneadMembershipABI.json";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS as string;
const ADMIN_SECRET = process.env.THIRDWEB_ADMIN_SECRET as string;
const PAID_TOKEN_ID = "1"; // This corresponds to PAID=1 in your smart contract

const client = createThirdwebClient({ secretKey: ADMIN_SECRET });

async function mintPremiumNFT(walletAddress: string) {
  const contract = getContract({
    client,
    address: CONTRACT_ADDRESS,
    chain: base,
    abi: kneadMembershipABI,
  });
  return mintTo({
    contract,
    to: walletAddress,
    tokenId: BigInt(PAID_TOKEN_ID),
    quantity: 1n,
  });
}

async function adminBurnPremiumNFT(walletAddress: string) {
  const contract = getContract({
    client,
    address: CONTRACT_ADDRESS,
    chain: base,
    abi: kneadMembershipABI,
  });
  return writeContract({
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
        const wallet = session.metadata?.wallet_address;
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
          const wallet = subscription.metadata?.wallet_address;
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
        const wallet = subscription.metadata?.wallet_address;
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
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscription = invoice.subscription as string;
        const sub = await stripe.subscriptions.retrieve(subscription);
        const wallet = sub.metadata?.wallet_address;
        if (wallet) {
          await mintPremiumNFT(wallet);
        }
        break;
      }
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const wallet = paymentIntent.metadata?.wallet_address;
        if (paymentIntent.metadata?.subscription_type === "premium" && wallet) {
          await mintPremiumNFT(wallet);
          if (paymentIntent.customer) {
            try {
              const subscription = await stripe.subscriptions.create({
                customer: paymentIntent.customer as string,
                items: [{ price: "price_1RhFCBLFxM3QV6ciPmZnxyfL" }],
                metadata: { wallet_address: wallet },
              });
              console.log(`Created subscription: ${subscription.id}`);
            } catch (subError) {
              console.error("Failed to create subscription:", subError);
            }
          }
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const wallet = paymentIntent.metadata?.wallet_address;
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
