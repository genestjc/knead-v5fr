import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ethers } from "ethers";
import kneadMembershipABI from "@/app/abi/kneadMembershipABI.json";
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

    // 2. Burn/revoke the NFT
    const provider = new ethers.JsonRpcProvider(
      process.env.BASE_RPC_URL!,
    );
    const wallet = new ethers.Wallet(
      process.env.THIRDWEB_PRIVATE_KEY!,
      provider,
    );
    const contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      kneadMembershipABI,
      wallet,
    );
    await contract.adminBurn(
      user_address,
      PREMIUM_TOKEN_ID,
      1,
    );

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
