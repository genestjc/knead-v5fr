import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

/**
 * Verify a payment succeeded server-side to prevent client-side spoofing
 * 
 * Called after stripe.confirmPayment() succeeds on the client.
 * Returns success only if:
 * 1. Payment actually succeeded (via Stripe API)
 * 2. Payment belongs to the requesting wallet address
 * 3. Payment amount matches expected price ($5.00)
 * 
 * This prevents users from faking payment success in the browser console.
 */
export async function POST(req: NextRequest) {
  try {
    const { paymentIntentId, walletAddress } = await req.json();

    // Validate required fields
    if (!paymentIntentId || !walletAddress) {
      console.error('[verify-payment] Missing required fields');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing paymentIntentId or walletAddress' 
        },
        { status: 400 }
      );
    }

    console.log(`[verify-payment] Verifying payment ${paymentIntentId} for wallet ${walletAddress}`);

    // Step 1: Retrieve payment intent from Stripe (server-side, cannot be faked)
    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (stripeError: any) {
      console.error('[verify-payment] Stripe API error:', stripeError.message);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid payment intent ID' 
        },
        { status: 400 }
      );
    }

    // Step 2: Verify payment succeeded
    if (paymentIntent.status !== 'succeeded') {
      console.warn(`[verify-payment] Payment status is ${paymentIntent.status}, not succeeded`);
      return NextResponse.json({
        success: false,
        error: `Payment not completed. Status: ${paymentIntent.status}`,
        status: paymentIntent.status,
      });
    }

    // Step 3: Get invoice and subscription to verify wallet address
    const invoiceId = paymentIntent.invoice;
    if (!invoiceId || typeof invoiceId !== 'string') {
      console.error('[verify-payment] No invoice found on payment intent');
      return NextResponse.json({
        success: false,
        error: 'Payment intent has no associated invoice',
      });
    }

    let invoice: Stripe.Invoice;
    try {
      invoice = await stripe.invoices.retrieve(invoiceId);
    } catch (invoiceError: any) {
      console.error('[verify-payment] Failed to retrieve invoice:', invoiceError.message);
      return NextResponse.json({
        success: false,
        error: 'Failed to retrieve payment invoice',
      });
    }

    const subscriptionId = invoice.subscription;
    if (!subscriptionId || typeof subscriptionId !== 'string') {
      console.error('[verify-payment] No subscription found on invoice');
      return NextResponse.json({
        success: false,
        error: 'Payment has no associated subscription',
      });
    }

    let subscription: Stripe.Subscription;
    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
    } catch (subError: any) {
      console.error('[verify-payment] Failed to retrieve subscription:', subError.message);
      return NextResponse.json({
        success: false,
        error: 'Failed to retrieve subscription',
      });
    }

    // Step 4: Verify wallet address matches subscription metadata
    const subscriptionWallet = subscription.metadata?.walletAddress?.toLowerCase();
    const requestWallet = walletAddress.toLowerCase();

    if (subscriptionWallet !== requestWallet) {
      console.error(
        `[verify-payment] Wallet mismatch! Subscription: ${subscriptionWallet}, Request: ${requestWallet}`
      );
      return NextResponse.json({
        success: false,
        error: 'Wallet address does not match payment',
      });
    }

    // Step 5: Verify amount matches expected price ($5.00 = 500 cents)
    const expectedAmount = 500;
    if (paymentIntent.amount !== expectedAmount) {
      console.warn(
        `[verify-payment] Amount mismatch! Expected ${expectedAmount}, got ${paymentIntent.amount}`
      );
      return NextResponse.json({
        success: false,
        error: `Invalid payment amount: $${(paymentIntent.amount / 100).toFixed(2)}`,
      });
    }

    // ✅ All checks passed - payment is legitimate!
    console.log(`[verify-payment] ✅ Payment verified successfully for wallet ${walletAddress}`);

    return NextResponse.json({
      success: true,
      subscriptionId,
      payment: {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
      },
      message: 'Payment verified successfully. Your membership is being activated.',
    });

  } catch (error: any) {
    console.error('[verify-payment] Unexpected error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'An unexpected error occurred during payment verification',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
