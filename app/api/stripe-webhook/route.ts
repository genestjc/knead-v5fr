import { NextRequest } from "next/server";
import Stripe from "stripe";
import { upsertPaidUser } from "@/lib/supabaseUser";
import {
  mintPremiumNFT,
  burnPremiumNFT,
} from "@/lib/nftActions";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-08-16",
});

export const config = { api: { bodyParser: false } };

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature") as string;
  const rawBody = await req.arrayBuffer();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      Buffer.from(rawBody),
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error(
      "Stripe webhook signature verification failed.",
      err,
    );
    return new Response(
      `Webhook Error: ${(err as Error).message}`,
      { status: 400 },
    );
  }

  // Handle successful payment (subscription created/paid)
  if (event.type === "checkout.session.completed") {
    const session = event.data
      .object as Stripe.Checkout.Session;
    const wallet = session.metadata?.wallet_address;
    const email = session.customer_email;

    if (wallet && email) {
      try {
        await mintPremiumNFT(wallet);
        await upsertPaidUser(wallet, email);
        console.log(
          `Minted premium NFT and stored user: ${wallet} / ${email}`,
        );
      } catch (err) {
        console.error(
          "Error minting NFT or storing user:",
          err,
        );
        return new Response(
          JSON.stringify({ error: "Internal error" }),
          { status: 500 },
        );
      }
    }
  }

  // Handle subscription cancellation or payment failure
  if (
    event.type === "customer.subscription.deleted" ||
    event.type === "invoice.payment_failed"
  ) {
    const subscription = event.data
      .object as Stripe.Subscription;
    const wallet = subscription.metadata?.wallet_address;

    if (wallet) {
      try {
        await burnPremiumNFT(wallet);
        console.log(`Burned premium NFT for: ${wallet}`);
      } catch (err) {
        console.error("Error burning NFT:", err);
        return new Response(
          JSON.stringify({ error: "Internal error" }),
          { status: 500 },
        );
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
  });
}
