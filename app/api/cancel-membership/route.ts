import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { sendEmail } from "@/lib/sendEmail";
import { cancellationEmail } from "@/lib/emailTemplates";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});

export async function POST(req: NextRequest) {
  try {
    const { user_address, email, subscriptionId } = await req.json();
    
    if (!user_address || !subscriptionId) {
      return NextResponse.json(
        { error: "Missing user_address or subscriptionId" },
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
      
      // Check if this subscription belongs to this wallet address
      const walletInMetadata = 
        subscription.metadata?.wallet_address || 
        subscription.metadata?.walletAddress;
        
      if (walletInMetadata && walletInMetadata.toLowerCase() !== user_address.toLowerCase()) {
        return NextResponse.json(
          { error: "This subscription does not belong to the provided wallet address" },
          { status: 403 },
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

    // 1. Cancel the Stripe subscription at period end
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
      metadata: { 
        cancellation_reason: "user_requested",
        cancelled_at: new Date().toISOString() 
      }
    });
    
    // Note: We DO NOT burn the NFT here
    // The NFT will be burned automatically by the webhook when the subscription actually ends

    // 2. Send cancellation email if provided
    if (email) {
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
    }

    return NextResponse.json({ 
      success: true,
      message: "Subscription cancelled. Your access will remain active until the end of your current billing period." 
    });
  } catch (error: any) {
    console.error("Cancellation error:", error);
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
