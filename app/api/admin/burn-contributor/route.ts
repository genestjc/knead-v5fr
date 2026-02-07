// app/api/admin/burn-contributor/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createThirdwebClient, getContract } from "thirdweb";
import { burn } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";
import { createSupabaseAdmin } from "@/lib/supabase/chat-client";

// ✅ Only get the client at module level (THIRDWEB_SECRET_KEY is safe during build)
const client = createThirdwebClient({ 
  secretKey: process.env.THIRDWEB_SECRET_KEY! 
});

const isAddress = (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address);

export async function POST(req: NextRequest) {
  try {
    // ✅ Check env vars at RUNTIME, not build time
    const CONTRIBUTOR_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS;
    const MASTER_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET; // Use NEXT_PUBLIC version

    if (!CONTRIBUTOR_CONTRACT_ADDRESS || !MASTER_ADMIN_ADDRESS) {
      return NextResponse.json({ 
        success: false, 
        error: "Server configuration error: Missing environment variables" 
      }, { status: 500 });
    }

    const { ownerAddress, tokenId, adminAddress } = await req.json();

    if (!ownerAddress || tokenId === undefined || !adminAddress) {
      return NextResponse.json({ 
        success: false, 
        error: "Missing required fields." 
      }, { status: 400 });
    }

    if (!isAddress(ownerAddress) || !isAddress(adminAddress)) {
      return NextResponse.json({ 
        success: false, 
        error: "Invalid address format." 
      }, { status: 400 });
    }

    if (adminAddress.toLowerCase() !== MASTER_ADMIN_ADDRESS.toLowerCase()) {
      return NextResponse.json({ 
        success: false, 
        error: "Unauthorized" 
      }, { status: 401 });
    }

    const contract = getContract({ 
      client, 
      address: CONTRIBUTOR_CONTRACT_ADDRESS, 
      chain: base 
    });

    const transaction = await burn({ 
      contract, 
      from: ownerAddress, 
      tokenId: BigInt(tokenId), 
      amount: 1n 
    });
    
    const supabase = createSupabaseAdmin();
    await supabase
      .from('chat_users')
      .update({ 
        role: 'viewer', 
        contributor_type: null 
      })
      .eq('address', ownerAddress.toLowerCase());

    return NextResponse.json({ 
      success: true, 
      transactionHash: transaction.transactionHash 
    });
  } catch (error) {
    console.error("Burning failed:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}
