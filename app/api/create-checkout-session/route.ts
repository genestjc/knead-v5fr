import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const { walletAddress } = await req.json();

  if (!walletAddress) {
    return NextResponse.json({ error: "Missing walletAddress" }, { status: 400 });
  }

  const YOUR_DOMAIN = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!, // Your price ID from the Stripe Dashboard
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${YOUR_DOMAIN}/join?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${YOUR_DOMAIN}/join`,
      
      // --- THIS IS THE FIX ---
      // This tells Stripe: "When you create the customer for this subscription,
      // automatically add this metadata to their profile."
      customer_creation: "always", // Or 'if_required'
      subscription_data: {
        metadata: {
          wallet_address: walletAddress,
        },
      },
      // If you are NOT using subscription_data, you can do it this way:
      // client_reference_id: walletAddress, // As a fallback
      // customer_email: someEmail, // Optional, if you collect it
      // customer_details: {
      //   metadata: {
      //     wallet_address: walletAddress
      //   }
      // }
      // --- END OF FIX ---
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error: any) {
    console.error("Error creating Stripe checkout session:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
