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

  const object = event.data.object as any;
  const metadata = object?.metadata;
  const user_address = metadata?.user_address;

  console.log(
    "Stripe event:",
    event.type,
    "User address:",
    user_address,
  );

  if (!user_address || !ethers.isAddress(user_address)) {
    return new NextResponse(
      "Missing or invalid user_address in Stripe metadata",
      { status: 400 },
    );
  }

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
    if (
      (event.type === "checkout.session.completed" ||
        event.type === "customer.subscription.created") &&
      user_address
    ) {
      const tx = await contract.mint(
        user_address,
        PREMIUM_TOKEN_ID,
        1,
      );
      await tx.wait();
      console.log("Minted premium NFT to:", user_address);
    }

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
      console.log("Burned premium NFT from:", user_address);
    }
  } catch (err: any) {
    console.error("Stripe webhook mint/burn error:", err);
    return new NextResponse(err.message, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
