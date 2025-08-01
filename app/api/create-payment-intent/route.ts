export async function POST(req: NextRequest) {
  try {
    const { walletAddress, amount, subscriptionType } = await req.json();
    
    // Create PaymentIntent with the customer's wallet address in metadata
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Amount in cents (e.g., 2000 for $20.00)
      currency: 'usd',
      automatic_payment_methods: { enabled: true }, // Let Stripe determine the best payment methods
      metadata: {
        wallet_address: walletAddress,
        subscription_type: subscriptionType // 'premium', 'basic', etc.
      }
    });
    
    // Return only the client secret to the frontend
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
