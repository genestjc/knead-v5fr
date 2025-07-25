import { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { upsertPaidUser } from "@/lib/supabaseUser";
import {
  mintPremiumNFT,
  burnPremiumNFT,
} from "@/lib/nftActions";
import getRawBody from "raw-body";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-08-16",
});

export const config = { api: { bodyParser: false } };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).end("Method Not Allowed");

  let event: Stripe.Event;
  const sig = req.headers["stripe-signature"] as string;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error(
      "Stripe webhook signature verification failed.",
      err,
    );
    return res
      .status(400)
      .send(`Webhook Error: ${(err as Error).message}`);
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
        return res
          .status(500)
          .json({ error: "Internal error" });
      }
    }
  }

  // Handle subscription cancellation or payment failure
  if (
    event.type === "customer.subscription.deleted" ||
    event.type === "invoice.payment_failed"
  ) {
    // You may need to look up the wallet address from Supabase using the Stripe customer ID
    const subscription = event.data
      .object as Stripe.Subscription;
    // If you store wallet in metadata, use that; otherwise, look up in Supabase
    const wallet = subscription.metadata?.wallet_address;

    if (wallet) {
      try {
        await burnPremiumNFT(wallet);
        console.log(`Burned premium NFT for: ${wallet}`);
      } catch (err) {
        console.error("Error burning NFT:", err);
        return res
          .status(500)
          .json({ error: "Internal error" });
      }
    }
  }

  res.status(200).json({ received: true });
}
