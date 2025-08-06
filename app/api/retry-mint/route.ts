import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getPrivateKey, privateKeyToAccount } from "thirdweb/wallets";
import { getContract, prepareContractCall, sendTransaction } from "thirdweb";
import { base } from "thirdweb/chains";
import { createClient } from "@supabase/supabase-js";

// Mark as dynamic
export const dynamic = 'force-dynamic';

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
  try {
    const { walletAddress, sessionId } = await req.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Missing wallet address" },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing session ID" },
        { status: 400 }
      );
    }

    console.log(`Retry mint request for wallet: ${walletAddress}, session: ${sessionId}`);

    // First check if the session is valid
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 400 }
      );
    }

    // Check if wallet address matches
    if (session.metadata?.walletAddress !== walletAddress) {
      return NextResponse.json(
        { error: "Wallet address does not match session" },
        { status: 400 }
      );
    }

    // Set up wallet for minting
    console.log("Setting up server wallet for minting...");
    const privateKey = getPrivateKey(process.env.THIRDWEB_PRIVATE_KEY!);
    const serverWallet = privateKeyToAccount(privateKey);

    console.log("Getting contract...");
    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: base,
      abi: kneadMembershipABI,
    });

    console.log(`Preparing to mint premium NFT for ${walletAddress}...`);
    
    // Check if user already has premium token
    try {
      const transaction = prepareContractCall({
        contract,
        method: "function balanceOf(address account, uint256 id) view returns (uint256)",
        params: [walletAddress, BigInt(PAID_TOKEN_ID)],
      });

      const balance = await sendTransaction({
        transaction,
      });

      if (balance > 0n) {
        console.log(`User ${walletAddress} already has premium token, skipping mint`);
        
        // Make sure subscription is marked as minted in DB
        await supabase
          .from("subscriptions")
          .update({
            token_minted: true,
            token_id: PAID_TOKEN_ID,
          })
          .eq("subscription_id", session.subscription)
          .eq("wallet_address", walletAddress.toLowerCase());
        
        return NextResponse.json({
          success: true,
          message: "User already has premium token",
          alreadyHasToken: true,
        });
      }
    } catch (error) {
      console.error("Error checking token balance:", error);
      // Continue with mint attempt anyway
    }

    // Prepare the mint transaction
    console.log("Preparing mint transaction...");
    const transaction = prepareContractCall({
      contract,
      method: "function mint(address to, uint256 id, uint256 amount)",
      params: [walletAddress, BigInt(PAID_TOKEN_ID), 1n],
    });

    // Execute the mint transaction
    console.log("Sending mint transaction...");
    const transactionResult = await sendTransaction({
      account: serverWallet,
      transaction,
    });

    console.log("NFT mint transaction successful:", transactionResult);

    // Update subscription in database with mint info
    await supabase
      .from("subscriptions")
      .update({
        token_minted: true,
        token_id: PAID_TOKEN_ID,
        mint_transaction_hash: transactionResult.transactionHash,
      })
      .eq("subscription_id", session.subscription)
      .eq("wallet_address", walletAddress.toLowerCase());

    return NextResponse.json({
      success: true,
      transactionHash: transactionResult.transactionHash,
    });
  } catch (error: any) {
    console.error("Error in retry-mint:", error);
    return NextResponse.json(
      {
        error: "Failed to mint NFT",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
