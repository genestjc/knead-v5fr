import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { sendEmail } from "@/lib/sendEmail";
import { cancellationEmail } from "@/lib/emailTemplates";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});
const CONTRACT_ADDRESS = "0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85";
const PREMIUM_TOKEN_ID = 1;

export async function POST(req: NextRequest) {
  try {
    const { user_address, email, subscriptionId } = await req.json();
    
    if (!user_address || !email || !subscriptionId) {
      return NextResponse.json(
        { error: "Missing user_address, email, or subscriptionId" },
        { status: 400 },
      );
    }

    // First check if subscription still exists and is active
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      if (subscription.status === 'canceled') {
        return NextResponse.json(
          { message: "Subscription already cancelled" },
          { status: 200 },
        );
      }
    } catch (err: any) {
      if (err.code === 'resource_missing') {
        return NextResponse.json(
          { error: "Subscription not found" },
          { status: 404 },
        );
      }
      throw err; // Re-throw unexpected errors
    }

    // 1. Cancel the Stripe subscription
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
      metadata: { 
        cancellation_reason: "user_requested",
        cancelled_at: new Date().toISOString() 
      }
    });

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
    
    if (!res.ok) {
      const data = await res.json();
      console.error("NFT burn failed:", data);
      
      // Don't return an error - we already cancelled the subscription
      // Just log the issue and continue with the cancellation process
    }

    // 3. Send cancellation email
    try {
      await sendEmail({
        to: email,
        subject: "We're sorry to see you go.",
        html: cancellationEmail(),
      });
    } catch (emailErr) {
      console.error("Failed to send cancellation email:", emailErr);
      // Continue even if email fails
    }

    return NextResponse.json({ 
      success: true,
      message: "Subscription cancelled and benefits removed" 
    });
  } catch (error: any) {
    console.error("Cancellation error:", error);
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
