import { NextRequest } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

async function mintPremiumNFT(walletAddress: string) {
  // Your existing NFT minting logic
  console.log(`Minting NFT for wallet: ${walletAddress}`);
}

async function burnPremiumNFT(walletAddress: string) {
  // Your existing NFT burning logic
  console.log(`Burning NFT for wallet: ${walletAddress}`);
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
    console.error(`Webhook signature verification failed: ${(err as Error).message}`);
    return new Response(
      `Webhook Error: ${(err as Error).message}`,
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      // Existing checkout flow events
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const wallet = session.metadata?.wallet_address;
        if (wallet) {
          await mintPremiumNFT(wallet);
        }
        break;
      }
      case "invoice.payment_failed":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const wallet = subscription.metadata?.wallet_address;
        if (wallet) {
          await burnPremiumNFT(wallet);
        }
        break;
      }
      case "invoice.payment_succeeded": {Sorry, there was an error generating the answer! Please try again.

Click [here](https://docs.stripe.com) to view the Stripe documentation
