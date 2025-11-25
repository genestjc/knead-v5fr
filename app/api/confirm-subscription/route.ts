import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16" as Stripe.LatestApiVersion,
});

export async function POST(req: NextRequest) {
  try {
    const { customerId, priceId, paymentMethodId, walletAddress } = await req.json();

    if (!customerId || !priceId || !paymentMethodId || !walletAddress) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Attach the payment method to the customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // Set as the default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
      metadata: {
        walletAddress: walletAddress,
      },
    });

    // Create the subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      metadata: {
        walletAddress: walletAddress,
      },
      expand: ["latest_invoice.payment_intent"],
    });

    // Check if the subscription was created successfully
    if (subscription.status === "active" || subscription.status === "trialing") {
      return NextResponse.json({
        success: true,
        subscriptionId: subscription.id,
        status: subscription.status,
      });
    }

    // Handle other statuses
    return NextResponse.json({
      success: false,
      subscriptionId: subscription.id,
      status: subscription.status,
      error: `Subscription status: ${subscription.status}`,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to confirm subscription";
    console.error("Error confirming subscription:", err);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
