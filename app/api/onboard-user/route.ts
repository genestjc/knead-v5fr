import { NextRequest, NextResponse } from "next/server";
import { getContract, prepareContractCall, Engine } from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";
import kneadMembershipABI from "../../abi/kneadMembershipABI.json";
import { createClient } from "@supabase/supabase-js";
import { client, serverWallet, SERVER_WALLET_ADDRESS } from "../../../thirdweb-server-wallet";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!;
const FREEMIUM_TOKEN_ID = 0;

// Mark as dynamic to ensure fresh data
export const dynamic = 'force-dynamic';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  console.log("🔍 onboard-user API called");
  const { walletAddress } = await req.json();
  
  if (!walletAddress) {
    console.error("❌ Missing wallet address in request");
    return NextResponse.json(
      { error: "Missing wallet address" },
      { status: 400 },
    );
  }

  console.log(`👤 Processing onboarding for wallet: ${walletAddress}`);

  try {
    // Verify we have all required environment variables
    if (!CONTRACT_ADDRESS) {
      console.error("❌ Missing NFT contract address environment variable");
      return NextResponse.json(
        { error: "Server configuration error: Missing contract address" },
        { status: 500 },
      );
    }
    
    // Verify server wallet is initialized
    if (!SERVER_WALLET_ADDRESS) {
      console.error("❌ Server wallet not properly initialized");
      return NextResponse.json(
        { error: "Server configuration error: Server wallet not initialized" },
        { status: 500 },
      );
    }
    
    // Log server wallet address for debugging
    console.log(`🔐 Using server wallet: ${SERVER_WALLET_ADDRESS}`);
    
    const normalizedAddress = walletAddress.toLowerCase();
    
    // Check if user exists in our database
    console.log(`📊 Checking if user exists in database: ${normalizedAddress}`);
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("wallet_address", normalizedAddress)
      .single();
      
    console.log(existingUser ? "📝 User found in database" : "📝 New user, not in database");
      
    // Get the contract instance
    console.log(`📜 Connecting to contract at ${CONTRACT_ADDRESS}`);
    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: base,
      abi: kneadMembershipABI,
    });
    
    // Check current token balance
    console.log(`⚖️ Checking if user already has freemium token (ID: ${FREEMIUM_TOKEN_ID})`);
    const balance = await balanceOf({
      contract,
      owner: walletAddress,
      tokenId: BigInt(FREEMIUM_TOKEN_ID),
    });
    
    console.log(`🔢 Current token balance: ${balance.toString()}`);
    
    // If user already has token, just return success
    if (balance > 0n) {
      console.log("✅ User already has freemium token, skipping mint");
      // Make sure user is in database
      if (!existingUser) {
        console.log("📊 Adding existing token holder to database");
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
    console.log(`🪙 Preparing to mint freemium token to ${walletAddress}`);
    
    try {
      const transaction = prepareContractCall({
        contract,
        method: "function mint(address to, uint256 id, uint256 amount)",
        params: [walletAddress, BigInt(FREEMIUM_TOKEN_ID), 1n],
        gasLimit: 300000n,
      });

      console.log("📤 Enqueueing mint transaction...");
      const { transactionId } = await serverWallet.enqueueTransaction({
        transaction,
      });

      console.log(`⏳ Waiting for transaction hash (ID: ${transactionId})...`);
      const { transactionHash } = await Engine.waitForTransactionHash({
        client,
        transactionId,
      });
      
      console.log(`✅ Mint transaction complete! Hash: ${transactionHash}`);
      console.log(`🔗 Transaction URL: https://basescan.org/tx/${transactionHash}`);

      // Add retry logic to verify the token was actually minted
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 2000; // 2 seconds
      
      let verificationSucceeded = false;
      
      for (let retry = 0; retry < MAX_RETRIES; retry++) {
        try {
          console.log(`🔍 Verifying mint (attempt ${retry + 1}/${MAX_RETRIES})...`);
          // Wait a bit before checking
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          
          // Check if token was minted
          const newBalance = await balanceOf({
            contract,
            owner: walletAddress,
            tokenId: BigInt(FREEMIUM_TOKEN_ID),
          });
          
          if (newBalance > 0n) {
            console.log("✅ Mint verification successful!");
            verificationSucceeded = true;
            break;
          } else {
            console.log("⚠️ Token not yet reflected in balance, retrying...");
          }
        } catch (verifyError) {
          console.error(`❌ Verification attempt ${retry + 1} failed:`, verifyError);
        }
      }
      
      if (!verificationSucceeded) {
        console.warn("⚠️ Could not verify token mint, but transaction was sent");
      }

      // Update or create user in database
      if (existingUser) {
        console.log("📊 Updating existing user in database");
        await supabase
          .from("users")
          .update({
            membership_status: "freemium",
            updated_at: new Date().toISOString(),
          })
          .eq("wallet_address", normalizedAddress);
      } else {
        console.log("📊 Adding new user to database");
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
      console.error("❌ Error minting token:", mintError);
      
      // Check for common errors
      const errorMsg = mintError.message || String(mintError);
      if (errorMsg.includes("insufficient funds")) {
        console.error("💰 Server wallet has insufficient funds for gas");
        return NextResponse.json(
          { 
            error: "Server wallet has insufficient funds for gas", 
            success: false,
            walletAddress: SERVER_WALLET_ADDRESS
          },
          { status: 500 },
        );
      }
      
      if (errorMsg.includes("execution reverted")) {
        console.error("🚫 Contract execution reverted - server wallet may not have minter role");
        return NextResponse.json(
          { 
            error: "Contract execution reverted - check permissions", 
            success: false,
            walletAddress: SERVER_WALLET_ADDRESS
          },
          { status: 500 },
        );
      }
      
      return NextResponse.json(
        { error: `Mint failed: ${errorMsg}`, success: false },
        { status: 500 },
      );
    }
    
  } catch (error: any) {
    console.error("❌ Error in onboarding process:", error);
    
    return NextResponse.json(
      { 
        error: `Failed to onboard user: ${error.message || String(error)}`,
        success: false
      },
      { status: 500 },
    );
  }
}
