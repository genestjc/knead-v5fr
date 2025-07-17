import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { buffer } from "micro";
import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { ethers } from "ethers";

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});

const CONTRACT_ADDRESS =
  "0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85";
const PREMIUM_TOKEN_ID = 1;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();

  let event: Stripe.Event;
  try {
    const sig = req.headers["stripe-signature"] as string;
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const error = err as Error;
    return res
      .status(400)
      .send(`Webhook Error: ${error.message}`);
  }

  const object = event.data.object as any;
  const metadata = object?.metadata;
  const user_address = metadata?.user_address;

  // Initialize Thirdweb SDK with private key
  const privateKey = process.env.THIRDWEB_PRIVATE_KEY!;
  const provider = new ethers.Wallet(
    privateKey,
    ethers.getDefaultProvider("base"),
  ); // or your custom RPC
  const sdk = new ThirdwebSDK(provider);

  const contract = await sdk.getContract(CONTRACT_ADDRESS);

  try {
    if (
      (event.type === "checkout.session.completed" ||
        event.type === "customer.subscription.created") &&
      user_address
    ) {
      // Call custom mint function
      await contract.call("mint", [
        user_address,
        PREMIUM_TOKEN_ID,
        1,
      ]);
    }

    if (
      (event.type === "customer.subscription.deleted" ||
        event.type === "invoice.payment_failed") &&
      user_address
    ) {
      // Call custom adminBurn function
      await contract.call("adminBurn", [
        user_address,
        PREMIUM_TOKEN_ID,
        1,
      ]);
    }
  } catch (err) {
    const error = err as Error;
    return res.status(500).send(error.message);
  }

  res.status(200).json({ received: true });
}
