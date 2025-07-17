import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();
  const { user_address } = req.body;
  if (!user_address)
    return res
      .status(400)
      .json({ error: "Missing user_address" });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/test-sandbox?success=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/test-sandbox?canceled=1`,
      metadata: { user_address },
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
}
