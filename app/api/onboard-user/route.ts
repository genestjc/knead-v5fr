import { NextRequest, NextResponse } from "next/server";
import { getContract } from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";
import { createClient } from "@supabase/supabase-js";
import { client } from "../../../thirdweb-client";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!;
const FREEMIUM_TOKEN_ID = 0;

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
    
    // If they don't have a token, call the mint-freemium endpoint
    console.log("🪙 User has no token, calling mint-freemium endpoint");
    const mintResponse = await fetch(new URL('/api/mint-freemium', req.url).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address: walletAddress }),
    });
    
    if (!mintResponse.ok) {
      const errorText = await mintResponse.text();
      throw new Error(`Mint-freemium endpoint failed: ${mintResponse.status} - ${errorText}`);
    }
    
    const mintResult = await mintResponse.json();
    
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
      success: mintResult.success,
      alreadyMinted: mintResult.alreadyMinted || false,
      userExists: !!existingUser,
      transactionHash: mintResult.transactionHash
    });
      
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
