import { NextRequest, NextResponse } from "next/server";
import { createThirdwebClient, getContract, mintTo } from "thirdweb";
import { base } from "thirdweb/chains";
import { headers } from "next/headers";
import { getFrameAccountAddress } from "frames.js";

// Initialize the Thirdweb client with your secret key
const client = createThirdwebClient({ secretKey: process.env.THIRDWEB_SECRET_KEY! });

// Your new Contributor NFT contract address
const CONTRIBUTOR_CONTRACT_ADDRESS = "0x967fd427f96D3580e142988d5bC73DB67e4C8e0f";
const MASTER_ADMIN_ADDRESS = '0xf27dafdd875759c4f21ddcd4b8a68e86e8e6206e';

// Define the metadata for each role
const ROLE_METADATA = {
  appointed: {
    tokenId: 10n,
    metadata: {
      name: "Appointed Contributor",
      description: "A foundational member of the Knead community, appointed for their influence and early support. This role grants the holder full posting access to the chat.",
      // Replace with your actual image IPFS hash or URL
      image: "ipfs://YOUR_APPOINTED_IMAGE_HASH", 
      attributes: [
        { trait_type: "Level", value: "Appointed" },
        { trait_type: "Multiplier", value: "0.8" }, // Use strings for attribute values for broad compatibility
        { trait_type: "Invitation Tokens", value: "3" },
        { trait_type: "Join Date", value: new Date().toISOString() },
      ],
    },
  },
  invited: {
    tokenId: 11n,
    metadata: {
      name: "Invited Contributor",
      description: "A community member nominated by their peers and approved by the admins. This role is the first step on the path to earning their place.",
      image: "ipfs://YOUR_INVITED_IMAGE_HASH",
      attributes: [
        { trait_type: "Level", value: "Invited" },
        { trait_type: "Multiplier", value: "1.0" },
        { trait_type: "Invitation Tokens", value: "2" },
        { trait_type: "Join Date", value: new Date().toISOString() },
      ],
    },
  },
  earned: {
    tokenId: 12n,
    metadata: {
      name: "Earned Contributor",
      description: "The highest rank of contributor, achieved through consistent, high-quality participation and community recognition. This role grants the highest point-awarding multiplier.",
      image: "ipfs://YOUR_EARNED_IMAGE_HASH",
      attributes: [
        { trait_type: "Level", value: "Earned" },
        { trait_type: "Multiplier", value: "1.5" },
        { trait_type: "Invitation Tokens", value: "3" },
        { trait_type: "Join Date", value: new Date().toISOString() },
      ],
    },
  },
};

export async function POST(req: NextRequest) {
  try {
    const { recipientAddress, role } = await req.json();

    // Security Check: Verify the request comes from the authenticated Master Admin
    const accountAddress = await getFrameAccountAddress({ headers: headers() });
    if (accountAddress?.toLowerCase() !== MASTER_ADMIN_ADDRESS.toLowerCase()) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!recipientAddress || !role || !ROLE_METADATA[role as keyof typeof ROLE_METADATA]) {
      return NextResponse.json({ success: false, error: "Invalid address or role" }, { status: 400 });
    }

    const { tokenId, metadata } = ROLE_METADATA[role as keyof typeof ROLE_METADATA];

    const contract = getContract({
      client,
      address: CONTRIBUTOR_CONTRACT_ADDRESS,
      chain: base,
    });

    // The Engine will handle gas and signing as the pre-configured minter wallet
    const transaction = await mintTo({
      contract,
      to: recipientAddress,
      tokenId: tokenId,
      supply: 1n, // Mint a single NFT
    });

    console.log("Minting transaction successful:", transaction.transactionHash);
    
    // Optional: After minting, you might want to update your Supabase table
    // to reflect this user's new role, linking their on-chain and off-chain data.
    // e.g., await updateSupabaseUserRole(recipientAddress, role);

    return NextResponse.json({ success: true, transactionHash: transaction.transactionHash });

  } catch (error) {
    console.error("Minting failed:", error);
    return NextResponse.json({ success: false, error: "An unexpected error occurred." }, { status: 500 });
  }
}
