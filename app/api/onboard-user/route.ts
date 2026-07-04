import { NextRequest, NextResponse } from "next/server";
import { getContract, prepareContractCall, Engine } from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";
import kneadMembershipABI from "../../abi/kneadMembershipABI.json";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { verifyWalletRequest } from "@/lib/auth/verify-wallet-request";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { alertIfServerWalletLow } from "@/lib/blockchain/server-wallet-balance";
import { client, serverWallet, SERVER_WALLET_ADDRESS } from "../../../thirdweb-server-wallet";
import { logger } from "@/lib/logger";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!;
const FREEMIUM_TOKEN_ID = 0;

// Mark as dynamic to ensure fresh data
export const dynamic = 'force-dynamic';

// ✅ NEW: In-memory lock to prevent concurrent mints for the same address
const mintingAddresses = new Set<string>();

export async function POST(req: NextRequest) {
  logger.log("🔍 onboard-user API called");

  // Rate limit by IP: a signature only proves control of *one* wallet, but an
  // attacker can generate many keypairs. Capping mints per IP bounds how fast
  // the server wallet's gas can be drained by Sybil onboarding. Set generously
  // so shared networks (offices, events, mobile NAT) onboarding many real users
  // at once aren't blocked; override via env without a redeploy.
  const onboardLimit = Number(process.env.ONBOARD_RATE_LIMIT_PER_HOUR ?? '20');
  const { success: withinLimit } = await rateLimit("onboard", getClientIp(req), {
    limit: onboardLimit,
    windowSeconds: 3600,
  });
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Too many onboarding attempts. Please try again later.", success: false },
      { status: 429 },
    );
  }

  // Authenticate: minting a freemium NFT costs real gas from the server wallet,
  // so the caller must prove (via wallet signature) they control the address
  // being onboarded. This blocks scripted mints to thousands of arbitrary
  // addresses that would drain the server wallet's gas.
  const auth = await verifyWalletRequest(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized", success: false },
      { status: auth.status ?? 401 },
    );
  }

  const { walletAddress } = await req.json();

  if (!walletAddress) {
    logger.error("❌ Missing wallet address in request");
    return NextResponse.json(
      { error: "Missing wallet address" },
      { status: 400 },
    );
  }

  const normalizedAddress = walletAddress.toLowerCase();

  // You may only onboard the wallet you signed with.
  if (normalizedAddress !== auth.address) {
    return NextResponse.json(
      { error: "Wallet address does not match the authenticated signer", success: false },
      { status: 403 },
    );
  }

  logger.log(`👤 Processing onboarding for wallet: ${normalizedAddress}`);

  // ✅ NEW: Check if already minting for this address
  if (mintingAddresses.has(normalizedAddress)) {
    logger.log(`⏸️ Mint already in progress for ${normalizedAddress}, rejecting duplicate request`);
    return NextResponse.json(
      { 
        error: "Mint already in progress for this address",
        success: false,
        duplicate: true
      },
      { status: 409 } // 409 Conflict
    );
  }

  // ✅ NEW: Mark as minting
  mintingAddresses.add(normalizedAddress);

  try {
    // Verify we have all required environment variables
    if (!CONTRACT_ADDRESS) {
      logger.error("❌ Missing NFT contract address environment variable");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }
    
    // Verify server wallet is initialized
    if (!SERVER_WALLET_ADDRESS) {
      logger.error("❌ Server wallet not properly initialized");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }
    
    // Log server wallet address for debugging
    logger.log(`🔐 Using server wallet: ${SERVER_WALLET_ADDRESS}`);
    
    const supabase = getSupabaseAdmin();
    
    // Check if user exists in our database
    logger.log(`📊 Checking if user exists in database: ${normalizedAddress}`);
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("wallet_address", normalizedAddress)
      .single();
      
    logger.log(existingUser ? "📝 User found in database" : "📝 New user, not in database");
      
    // Get the contract instance
    logger.log(`📜 Connecting to contract at ${CONTRACT_ADDRESS}`);
    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: base,
      abi: kneadMembershipABI,
    });
    
    // Check current token balance
    logger.log(`⚖️ Checking if user already has freemium token (ID: ${FREEMIUM_TOKEN_ID})`);
    const balance = await balanceOf({
      contract,
      owner: walletAddress,
      tokenId: BigInt(FREEMIUM_TOKEN_ID),
    });
    
    logger.log(`🔢 Current token balance: ${balance.toString()}`);
    
    // If user already has token, just return success
    if (balance > 0n) {
      logger.log("✅ User already has freemium token, skipping mint");
      
      // ✅ CHANGED: Use upsert instead of conditional insert
      logger.log("📊 Upserting user to database");
      await supabase.from("users").upsert(
        {
          wallet_address: normalizedAddress,
          membership_status: "freemium",
          created_at: existingUser?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { 
          onConflict: 'wallet_address',
          ignoreDuplicates: false
        }
      );
      
      return NextResponse.json({ 
        success: true, 
        alreadyMinted: true,
        userExists: !!existingUser
      });
    }
    
    // Mint freemium token
    logger.log(`🪙 Preparing to mint freemium token to ${walletAddress}`);

    // Fire-and-forget: warn us (once/hour) if the server wallet's gas is running
    // low. Doesn't block or fail the mint.
    void alertIfServerWalletLow();

    try {
      const transaction = prepareContractCall({
        contract,
        method: "function mint(address to, uint256 id, uint256 amount)",
        params: [walletAddress, BigInt(FREEMIUM_TOKEN_ID), 1n],
        gasLimit: 300000n,
      });

      logger.log("📤 Enqueueing mint transaction...");
      const { transactionId } = await serverWallet.enqueueTransaction({
        transaction,
      });

      logger.log(`⏳ Waiting for transaction hash (ID: ${transactionId})...`);
      const { transactionHash } = await Engine.waitForTransactionHash({
        client,
        transactionId,
      });
      
      logger.log(`✅ Mint transaction complete! Hash: ${transactionHash}`);
      logger.log(`🔗 Transaction URL: https://basescan.org/tx/${transactionHash}`);

      // Add retry logic to verify the token was actually minted
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 2000; // 2 seconds
      
      let verificationSucceeded = false;
      
      for (let retry = 0; retry < MAX_RETRIES; retry++) {
        try {
          logger.log(`🔍 Verifying mint (attempt ${retry + 1}/${MAX_RETRIES})...`);
          // Wait a bit before checking
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          
          // Check if token was minted
          const newBalance = await balanceOf({
            contract,
            owner: walletAddress,
            tokenId: BigInt(FREEMIUM_TOKEN_ID),
          });
          
          if (newBalance > 0n) {
            logger.log("✅ Mint verification successful!");
            verificationSucceeded = true;
            break;
          } else {
            logger.log("⚠️ Token not yet reflected in balance, retrying...");
          }
        } catch (verifyError) {
          logger.error(`❌ Verification attempt ${retry + 1} failed:`, verifyError);
        }
      }
      
      if (!verificationSucceeded) {
        logger.warn("⚠️ Could not verify token mint, but transaction was sent");
      }

      // ✅ CHANGED: Use upsert instead of conditional insert/update
      logger.log("📊 Upserting user to database");
      await supabase.from("users").upsert(
        {
          wallet_address: normalizedAddress,
          membership_status: "freemium",
          created_at: existingUser?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { 
          onConflict: 'wallet_address',
          ignoreDuplicates: false
        }
      );
      
      return NextResponse.json({ 
        success: true,
        userExists: !!existingUser,
        transactionHash,
        transactionId,
        verified: verificationSucceeded
      });
      
    } catch (mintError: any) {
      logger.error("❌ Error minting token:", mintError);
      
      // Check for common errors and log details server-side
      const errorMsg = mintError.message || String(mintError);
      if (errorMsg.includes("insufficient funds")) {
        logger.error("💰 Server wallet has insufficient funds for gas", { wallet: SERVER_WALLET_ADDRESS });
        return NextResponse.json(
          { 
            error: "Failed to process request", 
            success: false
          },
          { status: 500 },
        );
      }
      
      if (errorMsg.includes("execution reverted")) {
        logger.error("🚫 Contract execution reverted - server wallet may not have minter role", { wallet: SERVER_WALLET_ADDRESS });
        return NextResponse.json(
          { 
            error: "Failed to process request", 
            success: false
          },
          { status: 500 },
        );
      }
      
      return NextResponse.json(
        { error: "Failed to process request", success: false },
        { status: 500 },
      );
    }
    
  } catch (error: any) {
    logger.error("❌ Error in onboarding process:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to process request",
        success: false
      },
      { status: 500 },
    );
  } finally {
    // ✅ NEW: Always remove from minting set
    mintingAddresses.delete(normalizedAddress);
  }
}
