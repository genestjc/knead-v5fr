export const runtime = "nodejs";

import { NextRequest } from "next/server";
import Stripe from "stripe";
import {
  mintPremiumNFT,
  burnPremiumNFT,
} from "@/lib/nftActions";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!;
const STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2025-04-30",
});

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
    return new Response(
      `Webhook Error: ${(err as Error).message}`,
      { status: 400 },
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data
        .object as Stripe.Checkout.Session;
      const wallet = session.metadata?.wallet_address;
      if (wallet) {
        await mintPremiumNFT(wallet);
      }
      break;
    }
    case "invoice.payment_failed":
    case "customer.subscription.deleted": {
      const subscription = event.data
        .object as Stripe.Subscription;
      const wallet = subscription.metadata?.wallet_address;
      if (wallet) {
        await burnPremiumNFT(wallet);
      }
      break;
    }
    case "invoice.payment_succeeded": {
      // Optional: handle recurring payments
      const invoice = event.data.object as Stripe.Invoice;
      const subscription = invoice.subscription as string;
      const sub =
        await stripe.subscriptions.retrieve(subscription);
      const wallet = sub.metadata?.wallet_address;
      if (wallet) {
        await mintPremiumNFT(wallet);
      }
      break;
    }
    default:
      break;
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
  });
}
