export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const bodyParser = false;

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ethers } from "ethers";
import kneadMembershipABI from "@/app/abi/kneadMembershipABI.json";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});

const CONTRACT_ADDRESS =
  "0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85";
const PREMIUM_TOKEN_ID = 1;

export async function POST(req: NextRequest) {
  const rawBody = await req.arrayBuffer();
  const sig = req.headers.get("stripe-signature") as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      Buffer.from(rawBody),
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err: any) {
    return new NextResponse(
      `Webhook Error: ${err.message}`,
      { status: 400 },
    );
  }

  // Extract relevant data from the event
  const object = event.data.object as any;
  const metadata = object?.metadata;
  const user_address = metadata?.user_address;

  // Set up ethers provider and contract
  const provider = new ethers.JsonRpcProvider(
    process.env.BASE_RPC_URL!,
  );
  const wallet = new ethers.Wallet(
    process.env.THIRDWEB_PRIVATE_KEY!,
    provider,
  );
  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    kneadMembershipABI,
    wallet,
  );

  try {
    // Mint NFT on subscription creation or successful payment
    if (
      (event.type === "customer.subscription.created" ||
        event.type === "invoice.payment_succeeded") &&
      user_address
    ) {
      const tx = await contract.mint(
        user_address,
        PREMIUM_TOKEN_ID,
        1,
      );
      await tx.wait();
    }

    // Burn/revoke NFT on subscription cancellation or payment failure
    if (
      (event.type === "customer.subscription.deleted" ||
        event.type === "invoice.payment_failed") &&
      user_address
    ) {
      const tx = await contract.adminBurn(
        user_address,
        PREMIUM_TOKEN_ID,
        1,
      );
      await tx.wait();
    }

    // Optionally, handle subscription updates (e.g., upgrades/downgrades)
    // if (event.type === "customer.subscription.updated") {
    //   // Add custom logic here if needed
    // }
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
