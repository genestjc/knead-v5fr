import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ethers } from "ethers";
import kneadMembershipABI from "@/app/abi/kneadMembershipABI.json";
import { sendEmail } from "@/lib/sendEmail";
import {
  premiumWelcomeEmail,
  cancellationEmail,
} from "@/lib/emailTemplates";

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
    console.error(
      "Stripe webhook signature verification failed:",
      err,
    );
    return new NextResponse(
      `Webhook Error: ${err.message}`,
      { status: 400 },
    );
  }

  const object = event.data.object as any;
  const metadata = object?.metadata;
  const user_address = metadata?.user_address;

  // Try to get email from event object or fetch from Stripe if needed
  let email =
    object?.customer_email ||
    object?.email ||
    metadata?.email;
  if (!email && object?.customer) {
    try {
      const customer = await stripe.customers.retrieve(
        object.customer,
      );
      if (typeof customer === "object" && customer.email) {
        email = customer.email;
      }
    } catch (e) {
      // Ignore, email will be undefined if not found
    }
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

      // Send premium welcome email
      if (email) {
        await sendEmail({
          to: email,
          subject: "Welcome to Knead Monthly",
          html: premiumWelcomeEmail(),
        });
      }
    }

    // Burn/revoke NFT at end of paid period (after cancellation)
    if (
      event.type === "customer.subscription.deleted" &&
      user_address
    ) {
      const tx = await contract.adminBurn(
        user_address,
        PREMIUM_TOKEN_ID,
        1,
      );
      await tx.wait();

      // Send cancellation email
      if (email) {
        await sendEmail({
          to: email,
          subject: "We’re sorry to see you go.",
          html: cancellationEmail(),
        });
      }
    }

    // Burn/revoke NFT immediately on payment failure
    if (
      event.type === "invoice.payment_failed" &&
      user_address
    ) {
      const tx = await contract.adminBurn(
        user_address,
        PREMIUM_TOKEN_ID,
        1,
      );
      await tx.wait();
      // (Optional: send a payment failed email here)
    }
  } catch (err: any) {
    console.error("NFT mint/burn error:", err);
    return new NextResponse(err.message, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
