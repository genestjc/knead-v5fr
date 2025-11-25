import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16" as Stripe.LatestApiVersion,
});

// Default price amount in cents (e.g., 500 = $5.00)
const DEFAULT_PRICE_AMOUNT = 500;

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, priceId } = await req.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Missing wallet address" },
        { status: 400 }
      );
    }

    const price = priceId || process.env.STRIPE_PRICE_ID;
    if (!price) {
      return NextResponse.json(
        { error: "No price specified" },
        { status: 400 }
      );
    }

    // Retrieve price info to get the amount
    const priceInfo = await stripe.prices.retrieve(price);
    const amount = priceInfo.unit_amount || DEFAULT_PRICE_AMOUNT;

    // Check if customer already exists using search
    let customer: Stripe.Customer;
    
    try {
      const searchResult = await stripe.customers.search({
        query: `metadata['walletAddress']:'${walletAddress}'`,
        limit: 1,
      });
      
      if (searchResult.data.length > 0) {
        customer = searchResult.data[0];
      } else {
        // Create a new customer
        customer = await stripe.customers.create({
          metadata: {
            walletAddress: walletAddress,
          },
        });
      }
    } catch (searchError) {
      // If search fails, create a new customer (search API may not be enabled)
      console.error("Customer search failed, creating new customer:", searchError);
      customer = await stripe.customers.create({
        metadata: {
          walletAddress: walletAddress,
        },
      });
    }

    // Create a SetupIntent for setting up subscription payment
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ["card"],
      metadata: {
        walletAddress: walletAddress,
        priceId: price,
      },
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId: customer.id,
      priceId: price,
      amount: amount,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to create payment intent";
    console.error("Error creating payment intent:", err);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
