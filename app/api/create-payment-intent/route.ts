import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { verifyMemberRequest } from "@/lib/auth/member-session";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyMemberRequest(req);
    if (!auth.ok || !auth.address) {
      return NextResponse.json(
        { error: auth.error || "Missing wallet authentication" },
        { status: auth.status || 401 },
      );
    }

    const { walletAddress, amount } = await req.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Missing wallet address" },
        { status: 400 },
      );
    }

    const normalizedWalletAddress = walletAddress.toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(normalizedWalletAddress)) {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 },
      );
    }

    if (normalizedWalletAddress !== auth.address) {
      return NextResponse.json(
        { error: "Authenticated wallet does not match payment wallet" },
        { status: 403 },
      );
    }

    if (amount !== undefined && amount !== 500) {
      return NextResponse.json(
        { error: "Invalid payment amount" },
        { status: 400 },
      );
    }

    const limit = await rateLimit("create-payment-intent", auth.address, {
      limit: 5,
      windowSeconds: 60 * 60,
    });
    if (!limit.success) {
      return NextResponse.json(
        { error: "Too many payment attempts. Please try again later." },
        { status: 429 },
      );
    }

    if (!process.env.STRIPE_PRICE_ID) {
      console.error('STRIPE_PRICE_ID not set');
      return NextResponse.json(
        { error: "Server configuration error" },
        { status:  500 },
      );
    }

    // Step 1: Create or retrieve customer.
    //
    // Previously this listed the first 100 customers and scanned them in memory,
    // which silently breaks once the account passes 100 customers: existing
    // customers stop being found, so every checkout creates a *duplicate*
    // customer + subscription. Use Stripe's search API, which queries the whole
    // account by metadata regardless of size.
    let customer: Stripe.Customer;

    const found = await stripe.customers.search({
      query: `metadata['walletAddress']:'${normalizedWalletAddress}'`,
      limit: 1,
    });

    if (found.data.length > 0) {
      customer = found.data[0];
    } else {
      customer = await stripe.customers.create({
        metadata: {
          walletAddress:  normalizedWalletAddress,
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
        walletAddress:  normalizedWalletAddress,
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
