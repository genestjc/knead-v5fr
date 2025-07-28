import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { sendEmail } from "@/lib/sendEmail";
import { cancellationEmail } from "@/lib/emailTemplates";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});
const CONTRACT_ADDRESS =
  "0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85";
const PREMIUM_TOKEN_ID = 1;

export async function POST(req: NextRequest) {
  const { user_address, email, subscriptionId } =
    await req.json();
  if (!user_address || !email || !subscriptionId) {
    return NextResponse.json(
      {
        error:
          "Missing user_address, email, or subscriptionId",
      },
      { status: 400 },
    );
  }

  try {
    // 1. Cancel the Stripe subscription
    await stripe.subscriptions.del(subscriptionId);

    // 2. Burn/revoke the NFT via thirdweb HTTP API
    const res = await fetch(
      `https://api.thirdweb.com/v1/contract/${CONTRACT_ADDRESS}/erc1155/burn`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.THIRDWEB_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: user_address,
          tokenId: PREMIUM_TOKEN_ID,
          amount: 1,
        }),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || "Burn failed" },
        { status: 500 },
      );
    }

    // 3. Send cancellation email
    await sendEmail({
      to: email,
      subject: "We’re sorry to see you go.",
      html: cancellationEmail(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }
}
