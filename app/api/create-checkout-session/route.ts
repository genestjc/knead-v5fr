import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, priceId, redirectTo } =
      await req.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Missing wallet address" },
        { status: 400 },
      );
    }

    const price = priceId || process.env.STRIPE_PRICE_ID;
    if (!price) {
      return NextResponse.json(
        { error: "No price specified" },
        { status: 400 },
      );
    }

    // Fallback to site root if redirectTo is not provided
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://www.kneadmag.com";
    const returnUrl = redirectTo || baseUrl;

    // After payment, redirect back to the original page with session_id
    const success_url = `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url = `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}checkout=cancelled`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: price,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url,
      cancel_url,
      metadata: {
        walletAddress: walletAddress, // For checkout.session.completed
      },
      subscription_data: {
        metadata: {
          walletAddress: walletAddress, // For invoice.payment_succeeded
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Error creating checkout session:", err);
    return NextResponse.json(
      {
        error:
          err.message ||
          "Failed to create checkout session",
      },
      { status: 500 },
    );
  }
}
