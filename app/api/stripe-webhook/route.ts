import { NextRequest } from "next/server";
import Stripe from "stripe";
import { upsertPaidUser } from "@/lib/supabaseUser";
import {
  mintPremiumNFT,
  burnPremiumNFT,
} from "@/lib/nftActions";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30", // Match your Stripe dashboard version
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

  switch (event.type) {
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      // Only mint NFT on the first payment for a new subscription
      if (
        invoice.billing_reason === "subscription_create"
      ) {
        const subscription = invoice.subscription as string;
        const customer = invoice.customer as string;
        // Retrieve subscription to get metadata
        const sub =
          await stripe.subscriptions.retrieve(subscription);
        const wallet = sub.metadata?.wallet_address;
        const email =
          invoice.customer_email || sub.metadata?.email;
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
      break;
    }
    case "invoice.payment_failed":
    case "customer.subscription.deleted": {
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
      break;
    }
    // Optionally handle other events
    default:
      break;
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
  });
}
