import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;

export async function POST(req: NextRequest) {
  const { email, wallet_address, returnTo } =
    await req.json();

  if (!email || !wallet_address) {
    return NextResponse.json(
      { error: "Missing email or wallet address" },
      { status: 400 },
    );
  }

  if (!STRIPE_PRICE_ID) {
    return NextResponse.json(
      {
        error:
          "Stripe price ID is not set in environment variables",
      },
      { status: 500 },
    );
  }

  // Construct dynamic URLs
  const baseUrl = "https://kneadmag.com";
  const successUrl = returnTo
    ? `${baseUrl}${returnTo}?checkout=success`
    : `${baseUrl}/success`;
  const cancelUrl = returnTo
    ? `${baseUrl}${returnTo}?checkout=cancel`
    : `${baseUrl}/cancel`;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      customer_email: email,
      metadata: { wallet_address, email },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }
}
