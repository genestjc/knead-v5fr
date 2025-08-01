import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const SUBSCRIPTION_PRICE_ID = process.env.STRIPE_PRICE_ID || 'price_1RhFCBLFxM3QV6ciPmZnxyfL';

export async function POST(req: NextRequest) {
  try {
    const { walletAddress } = await req.json();
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Missing wallet address' },
        { status: 400 }
      );
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: SUBSCRIPTION_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.get('origin')}/join?success=true`,
      cancel_url: `${req.headers.get('origin')}/join?canceled=true`,
      metadata: {
        wallet_address: walletAddress,
      },
      subscription_data: {
        metadata: {
          wallet_address: walletAddress,
        },
      },
      // Optional: Collect customer email
      // billing_address_collection: 'auto',
      // customer_email: email,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
