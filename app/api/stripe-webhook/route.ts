import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ThirdwebSDK } from "thirdweb";

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});

const CONTRACT_ADDRESS =
  "0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85";
const PREMIUM_TOKEN_ID = 1;

export async function POST(req: NextRequest) {
  const rawBody = await req.arrayBuffer();
  const sig = req.headers.get("stripe-signature") as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      Buffer.from(rawBody),
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err: any) {
    return new NextResponse(
      `Webhook Error: ${err.message}`,
      { status: 400 },
    );
  }

  const object = event.data.object as any;
  const metadata = object?.metadata;
  const user_address = metadata?.user_address;

  const sdk = ThirdwebSDK.fromPrivateKey(
    process.env.THIRDWEB_PRIVATE_KEY!,
    "base",
  );
  const contract = await sdk.getContract(CONTRACT_ADDRESS);

  try {
    if (
      (event.type === "checkout.session.completed" ||
        event.type === "customer.subscription.created") &&
      user_address
    ) {
      await contract.call("mint", [
        user_address,
        PREMIUM_TOKEN_ID,
        1,
      ]);
    }

    if (
      (event.type === "customer.subscription.deleted" ||
        event.type === "invoice.payment_failed") &&
      user_address
    ) {
      await contract.call("adminBurn", [
        user_address,
        PREMIUM_TOKEN_ID,
        1,
      ]);
    }
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
