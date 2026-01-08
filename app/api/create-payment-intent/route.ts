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
      return NextResponse.json(
        { error: "Missing wallet address" },
        { status: 400 },
      );
    }

    // Amount in cents (default $5 for monthly subscription)
    const paymentAmount = amount || 500;

    // Step 1: Create or retrieve customer
    let customer:  Stripe.Customer;
    
    // Check if customer already exists with this wallet address
    const existingCustomers = await stripe.customers.list({
      limit: 1,
    });
    
    const existingCustomer = existingCustomers.data. find(
      (c) => c.metadata?.walletAddress === walletAddress
    );

    if (existingCustomer) {
      customer = existingCustomer;
    } else {
      customer = await stripe.customers.create({
        metadata: {
          walletAddress:  walletAddress,
        },
      });
    }

    // Step 2: Create the subscription
    const subscription = await stripe. subscriptions.create({
      customer: customer.id,
      items: [
        {
          price_data: {
            currency: "usd",
            product_data:  {
              name: "Knead Monthly Membership",
              description: "Unlimited access to Knead Monthly content",
            },
            unit_amount: paymentAmount,
            recurring: {
              interval: "month",
            },
          },
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
        ?  err.message
        : "Failed to create subscription";
    console.error("Error creating subscription:", err);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
