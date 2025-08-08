import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

// Mark as dynamic
export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, priceId } = await req.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Missing wallet address" },
        { status: 400 }
      );
    }

    const price = priceId || process.env.STRIPE_PRICE_ID;
    if (!price) {
      return NextResponse.json(
        { error: "No price specified" },
        { status: 400 }
      );
    }

    console.log(`Creating checkout session for wallet: ${walletAddress} with price: ${price}`);

    // Create checkout session - IMPORTANT: Don't include customer_email field
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: price,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/membership/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/membership/canceled`,
      metadata: {
        walletAddress: walletAddress,
      },
      // Remove the customer_email field entirely rather than setting it to null
    });

    console.log(`Checkout session created: ${session.id}`);
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Error creating checkout session:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
