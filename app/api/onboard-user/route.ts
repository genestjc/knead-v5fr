import { NextRequest, NextResponse } from "next/server";
import { prepareContractCall, Engine } from "thirdweb";
import { getMembershipContract } from "@/lib/contracts/getters";
import { checkTokenOwnership } from "@/lib/contracts/helpers";
import { createSupabaseAdmin } from "@/lib/supabase/chat-client";
import { client, serverWallet } from "../../../thirdweb-server-wallet";
import { logger } from "@/lib/logger";

const FREEMIUM_TOKEN_ID = 0;

// Mark as dynamic to ensure fresh data
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  logger.debug("🔍 onboard-user API called");
  const { walletAddress } = await req.json();
  
  if (!walletAddress) {
    logger.error("Missing wallet address in request");
    return NextResponse.json(
      { error: "Missing wallet address" },
      { status: 400 },
    );
  }

  logger.debug(`👤 Processing onboarding for wallet: ${walletAddress}`);

  try {
    const normalizedAddress = walletAddress.toLowerCase();
    
    // Get shared Supabase client
    const supabase = createSupabaseAdmin();
    
    // Check if user exists in our database
    logger.debug(`📊 Checking if user exists in database`);
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("wallet_address", normalizedAddress)
      .single();
      
    logger.debug(existingUser ? "User found in database" : "New user, not in database");
      
    // Check current token balance using shared helper
    logger.debug(`⚖️ Checking if user already has freemium token`);
    const { owned, balance } = await checkTokenOwnership(walletAddress, BigInt(FREEMIUM_TOKEN_ID));
    
    logger.debug(`🔢 Current token balance: ${balance.toString()}`);
    
    // If user already has token, just return success
    if (owned) {
      logger.debug("User already has freemium token, skipping mint");
      // Make sure user is in database
      if (!existingUser) {
        logger.debug("Adding existing token holder to database");
        await supabase.from("users").insert([
          {
            wallet_address: normalizedAddress,
            membership_status: "freemium",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
      }
      
      return NextResponse.json({ 
        success: true, 
        alreadyMinted: true,
        userExists: !!existingUser
      });
    }
    
    // Mint freemium token
    logger.debug(`🪙 Preparing to mint freemium token`);
    
    try {
      const contract = getMembershipContract();
      
      const transaction = prepareContractCall({
        contract,
        method: "function mint(address to, uint256 id, uint256 amount)",
        params: [walletAddress, BigInt(FREEMIUM_TOKEN_ID), 1n],
        gasLimit: 300000n,
      });

      logger.debug("Enqueueing mint transaction...");
      const { transactionId } = await serverWallet.enqueueTransaction({
        transaction,
      });

      logger.debug(`Waiting for transaction hash (ID: ${transactionId})...`);
      const { transactionHash } = await Engine.waitForTransactionHash({
        client,
        transactionId,
      });
      
      logger.logTransaction("Mint transaction complete", transactionHash);

      // Add retry logic to verify the token was actually minted
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 2000; // 2 seconds
      
      let verificationSucceeded = false;
      
      for (let retry = 0; retry < MAX_RETRIES; retry++) {
        try {
          logger.debug(`Verifying mint (attempt ${retry + 1}/${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          
          const { owned: newOwned } = await checkTokenOwnership(walletAddress, BigInt(FREEMIUM_TOKEN_ID));
          
          if (newOwned) {
            logger.debug("Mint verification successful!");
            verificationSucceeded = true;
            break;
          } else {
            logger.debug("Token not yet reflected in balance, retrying...");
          }
        } catch (verifyError) {
          logger.error(`Verification attempt ${retry + 1} failed:`, verifyError);
        }
      }
      
      if (!verificationSucceeded) {
        logger.warn("Could not verify token mint, but transaction was sent");
      }

      // Update or create user in database
      if (existingUser) {
        logger.debug("Updating existing user in database");
        await supabase
          .from("users")
          .update({
            membership_status: "freemium",
            updated_at: new Date().toISOString(),
          })
          .eq("wallet_address", normalizedAddress);
      } else {
        logger.debug("Adding new user to database");
        await supabase.from("users").insert([
          {
            wallet_address: normalizedAddress,
            membership_status: "freemium",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
      }
      
      return NextResponse.json({ 
        success: true,
        userExists: !!existingUser,
        transactionHash,
        transactionId,
        verified: verificationSucceeded
      });
      
    } catch (mintError: any) {
      logger.error("Error minting token:", mintError);
      
      // Generic error message for client, detailed logs on server
      return NextResponse.json(
        { error: "Failed to mint token", success: false },
        { status: 500 },
      );
    }
    
  } catch (error: any) {
    logger.error("Error in onboarding process:", error);
    
    // Generic error message for client
    return NextResponse.json(
      { error: "Failed to onboard user", success: false },
      { status: 500 },
    );
  }
}
