import { NextRequest } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

async function mintPremiumNFT(walletAddress: string) {
  // Your existing NFT minting logic
  console.log(`Minting NFT for wallet: ${walletAddress}`);
}

async function burnPremiumNFT(walletAddress: string) {
  // Your existing NFT burning logic
  console.log(`Burning NFT for wallet: ${walletAddress}`);
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature") as string;
  const rawBody = await req.arrayBuffer();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      Buffer.from(rawBody),
      sig,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error(`Webhook signature verification failed: ${(err as Error).message}`);
    return new Response(
      `Webhook Error: ${(err as Error).message}`,
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      // Existing checkout flow events
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const wallet = session.metadata?.wallet_address;
        if (wallet) {
          await mintPremiumNFT(wallet);
        }
        break;
      }
      case "invoice.payment_failed":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const wallet = subscription.metadata?.wallet_address;
        if (wallet) {
          await burnPremiumNFT(wallet);
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscription = invoice.subscription as string;
        const sub = await stripe.subscriptions.retrieve(subscription);
        const wallet = sub.metadata?.wallet_address;
        if (wallet) {
          await mintPremiumNFT(wallet);
        }
        break;
      }
      
      // New Payment Element flow events
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const wallet = paymentIntent.metadata?.wallet_address;
        
        // If this is for a subscription, handle accordingly
        if (paymentIntent.metadata?.subscription_type === 'premium' && wallet) {
          await mintPremiumNFT(wallet);
          
          // Optional: Create a subscription after successful payment
          // This is if you want to handle recurring billing
          if (paymentIntent.customer) {
            try {
              const subscription = await stripe.subscriptions.create({
                customer: paymentIntent.customer as string,
                items: [{ price: 'price_1RhFCBLFxM3QV6ciPmZnxyfL' }], // Replace with your price ID
                metadata: { wallet_address: wallet }
              });
              console.log(`Created subscription: ${subscription.id}`);
            } catch (subError) {
              console.error('Failed to create subscription:', subError);
            }
          }
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const wallet = paymentIntent.metadata?.wallet_address;
        
        // Log the failure
        if (wallet) {
          console.log(`Payment failed for wallet: ${wallet}`);
        }
        break;
      }
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
        break;
    }
    
    // Return a success response
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
    });
  } catch (err) {
    console.error(`Error processing webhook: ${(err as Error).message}`);
    return new Response(JSON.stringify({ 
      received: true,
      error: `Error processing webhook: ${(err as Error).message}` 
    }), {
      status: 200,
    });
  }
}
