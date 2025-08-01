export async function POST(req: NextRequest) {
  try {
    const { walletAddress, email, priceId } = await req.json();
    
    // 1. Create or retrieve a customer
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1,
    });
    
    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: email,
        metadata: { wallet_address: walletAddress },
      });
    }
    
    // 2. Create a SetupIntent to securely collect payment details
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['card'],
      metadata: {
        wallet_address: walletAddress,
        subscription_type: 'premium',
      },
    });
    
    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId: customer.id,
      setupIntentId: setupIntent.id,
      priceId: priceId,
    });
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to set up subscription' },
      { status: 500 }
    );
  }
}
