import Stripe from "stripe"

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set")
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
  typescript: true,
})

export async function createCheckoutSession({
  priceId,
  successUrl,
  cancelUrl,
  customerEmail,
  walletAddress,
}: {
  priceId: string
  successUrl: string
  cancelUrl: string
  customerEmail?: string
  walletAddress?: string
}) {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: customerEmail,
    metadata: {
      walletAddress: walletAddress || "",
    },
    subscription_data: {
      metadata: {
        walletAddress: walletAddress || "",
      },
    },
  })

  return session
}
