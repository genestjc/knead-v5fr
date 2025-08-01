import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, priceId, email } = await req.json();
    
    if (!walletAddress || !priceId) {
      return NextResponse.json(
        { error: 'Missing wallet address or price ID' },
        { status: 400 }
      );
    }

    // Create Checkout Session for subscription
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId, // Your subscription price ID
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.get('origin')}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/join?canceled=true`,
      metadata: {
        wallet_address: walletAddress,
      },
      customer_email: email, // Optional
      subscription_data: {
        metadata: {
          wallet_address: walletAddress,
        },
      }
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
