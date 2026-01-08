import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, amount } = await req.json();

    if (!walletAddress) {
      return NextResponse. json(
        { error: "Missing wallet address" },
        { status: 400 },
      );
    }

    // Step 1: Create or retrieve customer
    let customer: Stripe.Customer;
    
    // Search for existing customer with this wallet address
    const existingCustomers = await stripe.customers.search({
      query: `metadata['walletAddress']:'${walletAddress}'`,
      limit: 1,
    });
    
    if (existingCustomers.data. length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        metadata: {
          walletAddress: walletAddress,
        },
      });
    }

    // Step 2: Create the subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [
        {
          price: process.env. STRIPE_PRICE_ID!, // Use your existing Price ID
        },
      ],
      payment_behavior: "default_incomplete",
      payment_settings: {
        payment_method_types: ["card"],
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice. payment_intent"],
      metadata: {
        walletAddress: walletAddress,
      },
    });

    // Step 3: Get the client secret from the subscription's payment intent
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      subscriptionId: subscription.id,
    });
  } catch (err:  unknown) {
    const errorMessage =
      err instanceof Error
        ? err.message
        :  "Failed to create subscription";
    console.error("Error creating subscription:", err);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
