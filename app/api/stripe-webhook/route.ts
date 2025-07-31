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
      case "checkout.session.completed": {
        const session = event.data
          .object as Stripe.Checkout.Session;
        const wallet = session.metadata?.wallet_address;
        if (wallet) {
          await mintPremiumNFT(wallet);
        }
        break;
      }
      case "invoice.payment_failed":
      case "customer.subscription.deleted": {
        const subscription = event.data
          .object as Stripe.Subscription;
        const wallet = subscription.metadata?.wallet_address;
        if (wallet) {
          await burnPremiumNFT(wallet);
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscription = invoice.subscription as string;
        const sub =
          await stripe.subscriptions.retrieve(subscription);
        const wallet = sub.metadata?.wallet_address;
        if (wallet) {
          await mintPremiumNFT(wallet);
        }
        break;
      }
      default:
        // Still acknowledge the webhook even for events we don't handle
        break;
    }
    
    // Return a success response
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
    });
  } catch (err) {
    // Log the error but still return a 200 response to acknowledge receipt
    console.error(`Error processing webhook: ${(err as Error).message}`);
    return new Response(JSON.stringify({ 
      received: true,
      error: `Error processing webhook: ${(err as Error).message}` 
    }), {
      status: 200,
    });
  }
}
