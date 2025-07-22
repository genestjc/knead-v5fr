// app/api/create-subscription/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});

export async function POST(req: NextRequest) {
  const { email, user_address } = await req.json();

  try {
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
      items: [{ price: process.env.STRIPE_PRICE_ID! }],
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"],
      metadata: { user_address },
    });

    // 3. Get client_secret from PaymentIntent
    const paymentIntent = (
      subscription.latest_invoice as any
    ).payment_intent;
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      subscriptionId: subscription.id,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 },
    );
  }
}
