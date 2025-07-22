// app/api/stripe-webhook/route.ts
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
  // 1. Get the raw body as an arrayBuffer
  const rawBody = await req.arrayBuffer();
  // 2. Get the Stripe signature header
  const sig = req.headers.get("stripe-signature") as string;

  let event: Stripe.Event;
  try {
    // 3. Pass the raw body buffer, not a parsed object/string
    event = stripe.webhooks.constructEvent(
      Buffer.from(rawBody),
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err: any) {
    console.error(
      "Stripe webhook signature verification failed:",
      err,
    );
    return new NextResponse(
      `Webhook Error: ${err.message}`,
      { status: 400 },
    );
  }

  // 4. Extract user_address from metadata (if present)
  const object = event.data.object as any;
  const metadata = object?.metadata;
  const user_address = metadata?.user_address;

  // 5. Set up ethers provider and contract
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
      console.log(
        `Minting premium NFT for ${user_address}...`,
      );
      const tx = await contract.mint(
        user_address,
        PREMIUM_TOKEN_ID,
        1,
      );
      await tx.wait();
      console.log(`Minted premium NFT for ${user_address}`);
    }

    // Burn/revoke NFT immediately on payment failure
    if (
      event.type === "invoice.payment_failed" &&
      user_address
    ) {
      console.log(
        `Burning premium NFT for ${user_address} due to payment failure...`,
      );
      const tx = await contract.adminBurn(
        user_address,
        PREMIUM_TOKEN_ID,
        1,
      );
      await tx.wait();
      console.log(
        `Burned premium NFT for ${user_address} (payment failed)`,
      );
    }

    // Burn/revoke NFT at end of paid period (after cancellation)
    if (
      event.type === "customer.subscription.deleted" &&
      user_address
    ) {
      console.log(
        `Burning premium NFT for ${user_address} at end of paid period (subscription deleted)...`,
      );
      const tx = await contract.adminBurn(
        user_address,
        PREMIUM_TOKEN_ID,
        1,
      );
      await tx.wait();
      console.log(
        `Burned premium NFT for ${user_address} (subscription ended)`,
      );
    }

    // Optionally, handle subscription updates (e.g., upgrades/downgrades)
    // if (event.type === "customer.subscription.updated") {
    //   // Add custom logic here if needed
    // }
  } catch (err: any) {
    console.error("NFT mint/burn error:", err);
    return new NextResponse(err.message, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
