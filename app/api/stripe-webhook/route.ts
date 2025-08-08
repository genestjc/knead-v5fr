import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { privateKeyToAccount } from "thirdweb/wallets/private-key";
import { getContract, prepareContractCall, sendTransaction } from "thirdweb";
import { base } from "thirdweb/chains";
import { createClient } from "@supabase/supabase-js";

// Mark as dynamic route - required for Next.js API routes that use Request
export const dynamic = 'force-dynamic';

// For Next.js App Router, add this config to ensure raw body parsing
export const config = {
  api: {
    bodyParser: false,
  },
};

// Initialize stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

// Initialize supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// NFT contract details
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!;
const PAID_TOKEN_ID = 1; // Premium token ID

// Import ABI
import kneadMembershipABI from "@/app/abi/kneadMembershipABI.json";

// Create ThirdWeb client for server operations
const client = {
  secretKey: process.env.THIRDWEB_SECRET_KEY!,
};

export async function POST(req: NextRequest) {
  // Get the webhook signature from headers
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    console.error("No stripe signature found in request headers");
    return NextResponse.json({ error: "No stripe signature" }, { status: 400 });
  }

  try {
    // Get the raw body text
    const rawBody = await req.text();
    console.log("Processing Stripe webhook with signature:", signature.substring(0, 10) + "...");
    console.log("Webhook body length:", rawBody.length);

    // Verify the webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    console.log(`Webhook event type: ${event.type}, id: ${event.id}`);

    // Rest of the code is the same...
