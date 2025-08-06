import { NextRequest } from "next/server";
import Stripe from "stripe";
import { getContract, prepareContractCall, sendTransaction } from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";
import kneadMembershipABI from "../../abi/kneadMembershipABI.json";
import { createClient } from "@supabase/supabase-js";
import { client, serverWallet } from "../../../thirdweb-server-wallet";

// Enhanced logging helper
function logWithTimestamp(message, data = {}) {
  console.log(`[${new Date().toISOString()}] ${message}`, JSON.stringify(data, null, 2));
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS as string;
const PAID_TOKEN_ID = 1;

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Log wallet & contract details at startup
logWithTimestamp("Server wallet initialized", { 
  walletAddress: serverWallet.address,
  contractAddress: CONTRACT_ADDRESS,
});

async function hasPremiumNFT(walletAddress: string) {
  try {
    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: base,
      abi: kneadMembershipABI,
    });
    const balance = await balanceOf({
      contract,
      owner: walletAddress,
      tokenId: BigInt(PAID_TOKEN_ID),
    });
    return balance > 0n;
  } catch (error) {
    console.error("Error checking premium NFT:", error);
    return false;
  }
}

async function saveSubscription(walletAddress: string, subscriptionId: string, customerId: string, status = 'active') {
  try {
    // Get subscription details from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    await supabase.from("subscriptions").upsert(
      {
        wallet_address: walletAddress.toLowerCase(),
        customer_id: customerId,
        subscription_id: subscriptionId,
        status: status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: ["wallet_address", "subscription_id"] },
    );
    
    logWithTimestamp(`Saved subscription ${subscriptionId} for wallet ${walletAddress}`);
  } catch (error) {
    console.error(`Error saving subscription:`, error);
  }
}

async function updateSubscriptionStatus(subscriptionId: string, status: string) {
  try {
    await supabase
      .from("subscriptions")
      .update({ 
        status: status,
        updated_at: new Date().toISOString() 
      })
      .eq("subscription_id", subscriptionId);
      
    logWithTimestamp(`Updated subscription ${subscriptionId} status to ${status}`);
  } catch (error) {
    console.error(`Error updating subscription:`, error);
  }
}

// IMPROVED: Better error handling and logging in mintPremiumNFT
async function mintPremiumNFT(walletAddress: string) {
  logWithTimestamp(`Starting mintPremiumNFT process for ${walletAddress}`);
  
  try {
    // Record mint attempt in database for tracking
    await supabase.from("mint_attempts").insert({
      wallet_address: walletAddress.toLowerCase(),
      attempted_at: new Date().toISOString(),
      status: "started"
    });
    
    // Check if user already has NFT
    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: base,
      abi: kneadMembershipABI,
    });
    
    logWithTimestamp("Checking if wallet already has premium NFT");
    if (await hasPremiumNFT(walletAddress)) {
      logWithTimestamp(`Wallet ${walletAddress} already has premium NFT, skipping mint`);
      return;
    }
    
    // Prepare the transaction with explicit method name and parameters
    logWithTimestamp("Preparing mint transaction", {
      method: "mint",
      params: [walletAddress, PAID_TOKEN_ID, 1]
    });
    
    const transaction = prepareContractCall({
      contract,
      method: "function mint(address to, uint256 id, uint256 amount)",
      params: [walletAddress, BigInt(PAID_TOKEN_ID), 1n],
    });

    // Send transaction with server wallet and capture result
    logWithTimestamp("Sending mint transaction...");
    const result = await sendTransaction({
      account: serverWallet,
      transaction,
    });
    
    // Log success with transaction hash
    logWithTimestamp("Mint transaction sent successfully", {
      txHash: result.transactionHash,
      from: serverWallet.address,
      to: walletAddress,
      tokenId: PAID_TOKEN_ID
    });

    // Record successful mint in database
    await supabase.from("mint_attempts").update({
      status: "success", 
      transaction_hash: result.transactionHash,
      completed_at: new Date().toISOString()
    }).eq("wallet_address", walletAddress.toLowerCase()).eq("status", "started");

    // Update user membership status
    try {
      await supabase.from("users").upsert(
        {
          wallet_address: walletAddress.toLowerCase(),
          membership_status: "premium",
          updated_at: new Date().toISOString(),
        },
        { onConflict: ["wallet_address"] },
      );
    } catch (dbError) {
      console.error("Failed to update user status in Supabase:", dbError);
    }
    
  } catch (error: any) {
    // Enhanced error logging
    console.error(`Error minting premium NFT to ${walletAddress}:`);
    console.error(`- Error message: ${error.message}`);
    console.error(`- Error name: ${error.name}`);
    if (error.stack) console.error(`- Stack trace: ${error.stack}`);
    
    // Record failed mint in database
    await supabase.from("mint_attempts").update({
      status: "failed",
      error_message: error.message,
      completed_at: new Date().toISOString()
    }).eq("wallet_address", walletAddress.toLowerCase()).eq("status", "started");
    
    // Re-throw to be handled by webhook
    throw error;
  }
}

async function adminBurnPremiumNFT(walletAddress: string) {
  logWithTimestamp(`Starting adminBurn process for ${walletAddress}`);
  
  try {
    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: base,
      abi: kneadMembershipABI,
    });
    
    if (!(await hasPremiumNFT(walletAddress))) {
      logWithTimestamp(`Wallet ${walletAddress} does not have premium NFT, skipping burn`);
      return;
    }

    logWithTimestamp("Preparing burn transaction");
    const transaction = prepareContractCall({
      contract,
      method: "function adminBurn(address from, uint256 id, uint256 amount)",
      params: [walletAddress, BigInt(PAID_TOKEN_ID), 1n],
    });

    logWithTimestamp("Sending burn transaction...");
    const result = await sendTransaction({
      account: serverWallet,
      transaction,
    });
    
    logWithTimestamp("Burn transaction sent successfully", {
      txHash: result.transactionHash,
      from: serverWallet.address,
      burnFrom: walletAddress,
      tokenId: PAID_TOKEN_ID
    });

    // Update user status
    try {
      await supabase.from("users").upsert(
        {
          wallet_address: walletAddress.toLowerCase(),
          membership_status: "freemium",
          updated_at: new Date().toISOString(),
        },
        { onConflict: ["wallet_address"] },
      );
    } catch (dbError) {
      console.error("Failed to update user status in Supabase:", dbError);
    }
  } catch (error) {
    console.error(`Error burning premium NFT from ${walletAddress}:`, error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  // Create mint_attempts table if it doesn't exist
  try {
    // Check if table exists
    const { data: tablesData } = await supabase.from('mint_attempts').select('count(*)', { count: 'exact' }).limit(1);
    if (!tablesData) {
      // Create table if needed
      await supabase.rpc('create_mint_attempts_table_if_not_exists');
    }
  } catch (error) {
    console.log("Note: mint_attempts table may need to be created manually");
  }

  const sig = req.headers.get("stripe-signature") as string;
  const rawBody = await req.arrayBuffer();
  let event: Stripe.Event;
  
  // Log webhook call
  logWithTimestamp("Stripe webhook called", { 
    hasSignature: !!sig,
    bodySize: rawBody.byteLength 
  });

  try {
    event = stripe.webhooks.constructEvent(
      Buffer.from(rawBody),
      sig,
      STRIPE_WEBHOOK_SECRET,
    );
    
    logWithTimestamp("Webhook event received", { 
      type: event.type, 
      id: event.id 
    });
  } catch (err) {
    console.error(
      `Webhook signature verification failed: ${(err as Error).message}`,
    );
    return new Response(`Webhook Error: ${(err as Error).message}`, {
      status: 400,
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const wallet =
          session.metadata?.wallet_address || session.metadata?.walletAddress;
        
        logWithTimestamp("Processing checkout.session.completed", { 
          sessionId: session.id,
          wallet: wallet,
          hasMetadata: !!session.metadata,
          metadataKeys: session.metadata ? Object.keys(session.metadata) : []
        });
        
        if (!wallet) {
          console.error(
            "No wallet address found in session metadata:",
            session.id,
          );
          return new Response("No wallet address found in session metadata", {
            status: 200,
          });
        }
        
        // Mint the NFT
        await mintPremiumNFT(wallet);
        
        // If the session created a subscription, save it to the database
        if (session.subscription && session.customer) {
          await saveSubscription(
            wallet, 
            session.subscription as string,
            session.customer as string
          );
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) {
          logWithTimestamp("No subscription found in invoice, skipping", { invoiceId: invoice.id });
          break;
        }
        
        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription as string,
        );
        
        const wallet =
          subscription.metadata?.wallet_address ||
          subscription.metadata?.walletAddress;
          
        logWithTimestamp("Processing invoice.payment_succeeded", {
          invoiceId: invoice.id,
          subscriptionId: subscription.id,
          wallet: wallet,
          hasMetadata: !!subscription.metadata,
          metadataKeys: subscription.metadata ? Object.keys(subscription.metadata) : []
        });
        
        if (!wallet) {
          console.error(
            "No wallet address found in subscription metadata:",
            subscription.id,
          );
          break;
        }
        
        // Mint the NFT
        await mintPremiumNFT(wallet);
        
        // Save or update subscription details
        if (invoice.customer) {
          await saveSubscription(
            wallet,
            invoice.subscription as string,
            invoice.customer as string
          );
        }
        break;
      }
      // Rest of the cases remain the same...
      case "invoice.payment_failed":
      case "customer.subscription.deleted":
      case "payment_intent.succeeded":
        // Existing implementation...
        break;
      default:
        logWithTimestamp(`Unhandled event type: ${event.type}`);
        break;
    }
    
    return new Response(JSON.stringify({ 
      received: true,
      processed: true,
      eventType: event.type
    }), {
      status: 200,
    });
  } catch (err: any) {
    console.error(`Error processing webhook: ${err.message}`);
    console.error(err.stack);
    
    return new Response(
      JSON.stringify({
        received: true,
        processed: false,
        error: err.message,
        eventType: event?.type || 'unknown'
      }),
      {
        status: 200, // Still return 200 so Stripe doesn't retry
      },
    );
  }
}
