import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, amount, subscriptionType, email } = await req.json();
    
    if (!walletAddress || !amount || !subscriptionType) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, amount, or subscriptionType' },
        { status: 400 }
      );
    }

    // Optional: Create or retrieve a customer if you want to associate payments
    let customerId;
    if (email) {
      const customers = await stripe.customers.list({
        email: email,
        limit: 1,
      });
      
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: email,
          metadata: {
            wallet_address: walletAddress
          }
        });
        customerId = customer.id;
      }
    }
    
    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: parseInt(amount), // Make sure amount is an integer (cents)
      currency: 'usd',
      customer: customerId, // Optional: include if you created a customer
      automatic_payment_methods: { enabled: true },
      metadata: {
        wallet_address: walletAddress,
        subscription_type: subscriptionType
      }
    });
    
    return NextResponse.json({ 
      clientSecret: paymentIntent.client_secret,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}
