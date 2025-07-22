import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;

if (!STRIPE_SECRET_KEY) {
  throw new Error(
    "STRIPE_SECRET_KEY is not set in environment variables.",
  );
}
if (!STRIPE_PRICE_ID) {
  throw new Error(
    "STRIPE_PRICE_ID is not set in environment variables.",
  );
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
});

export async function POST(req: NextRequest) {
  try {
    const { email, user_address } = await req.json();

    if (!email || !user_address) {
      return NextResponse.json(
        { error: "Missing email or user_address" },
        { status: 400 },
      );
    }

    // 1. Create or retrieve customer
    const customers = await stripe.customers.list({
      email,
      limit: 1,
    });
    let customer = customers.data[0];
    if (!customer) {
      customer = await stripe.customers.create({
        email,
        metadata: { user_address },
      });
    }

    // 2. Create subscription with payment_behavior: "default_incomplete"
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: STRIPE_PRICE_ID }],
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"],
      metadata: { user_address },
    });

    // 3. Get client_secret from PaymentIntent
    const paymentIntent = (
      subscription.latest_invoice as any
    ).payment_intent;
    if (!paymentIntent || !paymentIntent.client_secret) {
      return NextResponse.json(
        {
          error:
            "Failed to create PaymentIntent for subscription.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      subscriptionId: subscription.id,
    });
  } catch (err: any) {
    console.error("Stripe subscription error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 },
    );
  }
}
