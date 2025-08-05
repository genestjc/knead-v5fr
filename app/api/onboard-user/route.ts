import { NextRequest, NextResponse } from "next/server";
import { getContract, prepareContractCall, sendTransaction } from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";
import kneadMembershipABI from "../../abi/kneadMembershipABI.json";
import { createClient } from "@supabase/supabase-js";
import { client, serverWallet } from "../../../thirdweb-server-wallet";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!;
const FREEMIUM_TOKEN_ID = 0;

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const { walletAddress } = await req.json();
  
  if (!walletAddress) {
    return NextResponse.json(
      { error: "Missing wallet address" },
      { status: 400 },
    );
  }

  try {
    const normalizedAddress = walletAddress.toLowerCase();
    
    // Check if user exists in our database
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("wallet_address", normalizedAddress)
      .single();
      
    // Get the contract instance
    const contract = getContract({
      client,
      address: CONTRACT_ADDRESS,
      chain: base,
      abi: kneadMembershipABI,
    });
    
    // Check current token balance
    const balance = await balanceOf({
      contract,
      owner: walletAddress,
      tokenId: BigInt(FREEMIUM_TOKEN_ID),
    });
    
    // If user already has token, just return success
    if (balance > 0n) {
      // Make sure user is in database
      if (!existingUser) {
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
    const transaction = prepareContractCall({
      contract,
      method: "function mint(address to, uint256 id, uint256 amount)",
      params: [walletAddress, BigInt(FREEMIUM_TOKEN_ID), 1n],
    });

    await sendTransaction({
      account: serverWallet,
      transaction,
    });
    
    // Update or create user in database
    if (existingUser) {
      await supabase
        .from("users")
        .update({
          membership_status: "freemium",
          updated_at: new Date().toISOString(),
        })
        .eq("wallet_address", normalizedAddress);
    } else {
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
      userExists: !!existingUser
    });
  } catch (error: any) {
    console.error("Error onboarding user:", error);
    
    return NextResponse.json(
      { 
        error: error.message || "Failed to onboard user",
        success: false
      },
      { status: 500 },
    );
  }
}
