import { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { upsertPaidUser } from "@/lib/supabaseUser";
// Import your NFT mint/burn logic here

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-08-16",
});

export const config = { api: { bodyParser: false } };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const sig = req.headers["stripe-signature"]!;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    return res
      .status(400)
      .send(`Webhook Error: ${(err as Error).message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data
      .object as Stripe.Checkout.Session;
    const wallet = session.metadata?.wallet_address;
    const email = session.customer_email;

    if (wallet && email) {
      await upsertPaidUser(wallet, email);
      // Mint premium NFT to wallet here
    }
  }

  if (
    event.type === "customer.subscription.deleted" ||
    event.type === "invoice.payment_failed"
  ) {
    // Burn premium NFT from wallet here
  }

  res.status(200).json({ received: true });
}
