export async function POST(req: NextRequest) {
  try {
    const { setupIntentId, customerId, priceId, walletAddress } = await req.json();
    
    // Retrieve the setup intent to get the payment method
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
    if (!setupIntent.payment_method) {
      throw new Error('No payment method was attached to the SetupIntent');
    }
    
    // Create the subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: setupIntent.payment_method as string,
      metadata: {
        wallet_address: walletAddress,
        setup_intent_id: setupIntentId,
      },
      expand: ['latest_invoice.payment_intent'],
    });
    
    return NextResponse.json({
      subscription: subscription,
      subscriptionId: subscription.id,
      status: subscription.status,
    });
  } catch (error: any) {
    console.error('Error completing subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete subscription' },
      { status: 500 }
    );
  }
}
