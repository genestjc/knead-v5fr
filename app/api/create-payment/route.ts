import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});

export async function POST(req: NextRequest) {
  try {
    const { amount, wallet_address, payment_type } = await req.json();
    
    if (!wallet_address || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // For subscription
    if (payment_type === 'subscription') {
      const customer = await createOrRetrieveCustomer(wallet_address);
      
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: process.env.SUBSCRIPTION_PRICE_ID }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: { wallet_address },
      });
      
      // @ts-ignore - The expanded fields aren't properly typed
      const clientSecret = subscription.latest_invoice.payment_intent.client_secret;
      
      return NextResponse.json({
        clientSecret,
        subscription_id: subscription.id,
        customer_id: customer.id
      });
    }
    
    // For one-time payment
    else {
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: { wallet_address },
      });
      
      return NextResponse.json({
        clientSecret: paymentIntent.client_secret
      });
    }
  } catch (error: any) {
    console.error("Payment creation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create payment" },
      { status: 500 }
    );
  }
}

// Helper function to create or retrieve a customer by wallet address
async function createOrRetrieveCustomer(walletAddress: string) {
  // Search for existing customer by metadata
  const customers = await stripe.customers.list({
    query: `metadata['wallet_address']:'${walletAddress}'`,
  });
  
  if (customers.data.length > 0) {
    return customers.data[0];
  }
  
  // Create new customer if none exists
  return stripe.customers.create({
    metadata: { wallet_address: walletAddress },
  });
}
