import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30",
});

export async function POST(req: NextRequest) {
  const { email, wallet_address } = await req.json();

  if (!email || !wallet_address) {
    return NextResponse.json(
      { error: "Missing email or wallet address" },
      { status: 400 },
    );
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        { price: "YOUR_STRIPE_PRICE_ID", quantity: 1 }, // Replace with your Stripe price ID
      ],
      customer_email: email,
      metadata: { wallet_address, email },
      success_url: "https://yourdomain.com/success",
      cancel_url: "https://yourdomain.com/cancel",
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }
}
