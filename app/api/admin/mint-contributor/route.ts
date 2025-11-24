import { NextRequest, NextResponse } from "next/server";
import { createThirdwebClient, getContract, mintTo } from "thirdweb";
import { base } from "thirdweb/chains";
import { createSupabaseAdmin } from "@/lib/supabase/chat-client";

// Ensure you have these in your .env.local file
const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY;
const CONTRIBUTOR_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS;
const MASTER_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_MASTER_ADMIN_ADDRESS;

if (!THIRDWEB_SECRET_KEY || !CONTRIBUTOR_CONTRACT_ADDRESS || !MASTER_ADMIN_ADDRESS) {
  throw new Error("Missing required environment variables for minting.");
}

const client = createThirdwebClient({ secretKey: THIRDWEB_SECRET_KEY });

// Metadata for each role. We'll set the join date dynamically.
const getRoleMetadata = (role: string) => {
  const baseMetadata = {
    appointed: {
      tokenId: 10n,
      metadata: {
        name: "Appointed Contributor",
        description: "A foundational member of the Knead community, appointed for their influence and early support.",
        image: "ipfs://Qmdy5tso1FFa324TqgL1m8m3g4t7W5t6y7z8u9i0o1p2q3", // REPLACE with actual IPFS hash
        attributes: [
          { trait_type: "Level", value: "Appointed" },
          { trait_type: "Multiplier", value: "0.8" },
          { trait_type: "Invitation Tokens", value: "3" },
        ],
      },
    },
    invited: {
      tokenId: 11n,
      metadata: {
        name: "Invited Contributor",
        description: "A community member nominated by their peers. This role is the first step on the path to earning their place.",
        image: "ipfs://QmY7z8u9i0o1p2q3mdy5tso1FFa324TqgL1m8m3g4t7W5t", // REPLACE with actual IPFS hash
        attributes: [
          { trait_type: "Level", value: "Invited" },
          { trait_type: "Multiplier", value: "1.0" },
          { trait_type: "Invitation Tokens", value: "2" },
        ],
      },
    },
    earned: {
      tokenId: 12n,
      metadata: {
        name: "Earned Contributor",
        description: "The highest rank of contributor, achieved through consistent, high-quality participation and community recognition.",
        image: "ipfs://QmZ8u9i0o1p2q3mdy5tso1FFa324TqgL1m8m3g4t7W5t6y", // REPLACE with actual IPFS hash
        attributes: [
          { trait_type: "Level", value: "Earned" },
          { trait_type: "Multiplier", value: "1.5" },
          { trait_type: "Invitation Tokens", value: "3" },
        ],
      },
    },
  };

  const roleData = baseMetadata[role as keyof typeof baseMetadata];
  if (!roleData) return null;

  // Add dynamic Join Date attribute
  roleData.metadata.attributes.push({
    trait_type: "Join Date",
    value: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  });

  return roleData;
};

export async function POST(req: NextRequest) {
  try {
    const { recipientAddress, role, adminAddress } = await req.json();

    // Security Check: Verify the request comes from an authenticated Master Admin
    if (adminAddress?.toLowerCase() !== MASTER_ADMIN_ADDRESS.toLowerCase()) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const roleData = getRoleMetadata(role);
    if (!recipientAddress || !roleData) {
      return NextResponse.json({ success: false, error: "Invalid address or role" }, { status: 400 });
    }

    const contract = getContract({
      client,
      address: CONTRIBUTOR_CONTRACT_ADDRESS,
      chain: base,
    });

    // Mint the NFT using Thirdweb Engine (which handles gas and signing)
    const transaction = await mintTo({
      contract,
      to: recipientAddress,
      tokenId: roleData.tokenId,
      supply: 1n,
    });

    // After successfully minting, update the Supabase table to keep it in sync.
    const supabase = createSupabaseAdmin();
    const { error: updateError } = await supabase
      .from("chat_users")
      .update({ role: "contributor", contributor_type: role })
      .eq("address", recipientAddress.toLowerCase());

    if (updateError) {
      // Log the error but don't fail the request, as the on-chain action succeeded.
      console.error("Supabase sync error after minting:", updateError.message);
    }

    return NextResponse.json({ success: true, transactionHash: transaction.transactionHash });

  } catch (error) {
    console.error("Minting failed:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
