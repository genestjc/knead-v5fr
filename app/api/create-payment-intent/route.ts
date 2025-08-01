import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, amount, subscriptionType } = await req.json();
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Missing wallet address' },
        { status: 400 }
      );
    }

    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount || 500, // $5.00 monthly subscription
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        wallet_address: walletAddress,
        subscription_type: subscriptionType || 'premium'
      }
    });
    
    return NextResponse.json({ 
      clientSecret: paymentIntent.client_secret
    });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}
