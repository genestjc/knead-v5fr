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

    if (!process.env.STRIPE_PRICE_ID) {
      console.error('STRIPE_PRICE_ID not set');
      return NextResponse.json(
        { error: "Server configuration error" },
        { status:  500 },
      );
    }

    // Step 1: Create or retrieve customer
    let customer:  Stripe.Customer;
    
    const existingCustomers = await stripe.customers.list({
      limit: 100,
    });
    
    const existingCustomer = existingCustomers.data.find(
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

    // Step 2: Create the subscription (expand only latest_invoice)
    const subscription = await stripe. subscriptions.create({
      customer: customer.id,
      items: [
        {
          price: process.env.STRIPE_PRICE_ID! ,
        },
      ],
      payment_behavior: "default_incomplete",
      payment_settings: {
        payment_method_types: ["card"],
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice"], // ← Only expand the invoice
      metadata: {
        walletAddress:  walletAddress,
      },
    });

    // Step 3: Get the invoice and retrieve the payment intent separately
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    
    if (!invoice || typeof invoice === 'string') {
      throw new Error('Failed to get invoice from subscription');
    }

    // Get the payment intent ID from the invoice
    const paymentIntentId = typeof invoice. payment_intent === 'string' 
      ? invoice.payment_intent 
      : invoice.payment_intent?.id;

    if (!paymentIntentId) {
      throw new Error('No payment intent found on invoice');
    }

    // Retrieve the full payment intent object
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (!paymentIntent. client_secret) {
      throw new Error('No client secret on payment intent');
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      subscriptionId: subscription.id,
    });
  } catch (err:  unknown) {
    const errorMessage =
      err instanceof Error
        ? err.message
        :  "Failed to create subscription";
    
    console.error("[create-payment-intent] Error:", errorMessage);
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
