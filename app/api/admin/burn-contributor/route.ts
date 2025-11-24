import { NextRequest, NextResponse } from "next/server";
import { createThirdwebClient, getContract, burn } from "thirdweb";
import { base } from "thirdweb/chains";
import { createSupabaseAdmin } from "@/lib/supabase/chat-client";

const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY;
const CONTRIBUTOR_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS;
const MASTER_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_MASTER_ADMIN_ADDRESS;

if (!THIRDWEB_SECRET_KEY || !CONTRIBUTOR_CONTRACT_ADDRESS || !MASTER_ADMIN_ADDRESS) {
  throw new Error("Missing required environment variables for burning.");
}

const client = createThirdwebClient({ secretKey: THIRDWEB_SECRET_KEY });

export async function POST(req: NextRequest) {
  try {
    const { ownerAddress, tokenId, adminAddress } = await req.json();

    // Security Check: Verify admin
    if (adminAddress?.toLowerCase() !== MASTER_ADMIN_ADDRESS.toLowerCase()) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!ownerAddress || !tokenId) {
      return NextResponse.json({ success: false, error: "Invalid owner address or token ID" }, { status: 400 });
    }

    const contract = getContract({
      client,
      address: CONTRIBUTOR_CONTRACT_ADDRESS,
      chain: base,
    });

    // Burn the NFT using Thirdweb Engine
    const transaction = await burn({
      contract,
      from: ownerAddress,
      tokenId: BigInt(tokenId),
      amount: 1n,
    });
    
    // After successfully burning, downgrade the user in Supabase.
    const supabase = createSupabaseAdmin();
    const { error: updateError } = await supabase
        .from('chat_users')
        .update({ role: 'viewer', contributor_type: null })
        .eq('address', ownerAddress.toLowerCase());

    if (updateError) {
        console.error("Supabase sync error after burning:", updateError.message);
    }

    return NextResponse.json({ success: true, transactionHash: transaction.transactionHash });

  } catch (error) {
    console.error("Burning failed:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
