import { NextRequest, NextResponse } from "next/server";
import { createThirdwebClient, getContract } from "thirdweb";
import { mintTo } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";
import { createSupabaseAdmin } from "@/lib/supabase/chat-client";

const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY;
const CONTRIBUTOR_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS;
const MASTER_ADMIN_ADDRESS = process.env.MASTER_ADMIN_WALLET; // UPDATED to use your variable name

if (!THIRDWEB_SECRET_KEY || !CONTRIBUTOR_CONTRACT_ADDRESS || !MASTER_ADMIN_ADDRESS) {
  throw new Error("Missing required environment variables for minting.");
}

const client = createThirdwebClient({ secretKey: THIRDWEB_SECRET_KEY });
const isAddress = (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address);

const getRoleMetadata = (role: string) => {
  const baseMetadata = {
    appointed: { tokenId: 10n, metadata: { name: "Appointed Contributor", image: "ipfs://...", attributes: [{ trait_type: "Level", value: "Appointed" }, { trait_type: "Multiplier", value: "0.8" }, { trait_type: "Invitation Tokens", value: "3" }]}},
    invited: { tokenId: 11n, metadata: { name: "Invited Contributor", image: "ipfs://...", attributes: [{ trait_type: "Level", value: "Invited" }, { trait_type: "Multiplier", value: "1.0" }, { trait_type: "Invitation Tokens", value: "2" }]}},
    earned: { tokenId: 12n, metadata: { name: "Earned Contributor", image: "ipfs://...", attributes: [{ trait_type: "Level", value: "Earned" }, { trait_type: "Multiplier", value: "1.5" }, { trait_type: "Invitation Tokens", value: "3" }]}},
  };

  const roleData = baseMetadata[role as keyof typeof baseMetadata];
  if (!roleData) return null;

  const clonedData = JSON.parse(JSON.stringify(roleData));
  clonedData.metadata.attributes.push({ trait_type: "Join Date", value: new Date().toISOString().split('T')[0] });
  return clonedData;
};

export async function POST(req: NextRequest) {
  try {
    const { recipientAddress, role, adminAddress } = await req.json();

    if (!recipientAddress || !role || !adminAddress) {
      return NextResponse.json({ success: false, error: "Missing required fields." }, { status: 400 });
    }
    if (!isAddress(recipientAddress) || !isAddress(adminAddress)) {
      return NextResponse.json({ success: false, error: "Invalid address format." }, { status: 400 });
    }
    if (adminAddress.toLowerCase() !== MASTER_ADMIN_ADDRESS.toLowerCase()) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const roleData = getRoleMetadata(role);
    if (!roleData) {
      return NextResponse.json({ success: false, error: "Invalid role specified." }, { status: 400 });
    }

    const contract = getContract({ client, address: CONTRIBUTOR_CONTRACT_ADDRESS, chain: base });
    const transaction = await mintTo({ contract, to: recipientAddress, tokenId: roleData.tokenId, amount: 1n });

    const supabase = createSupabaseAdmin();
    await supabase.from("chat_users").update({ role: "contributor", contributor_type: role }).eq("address", recipientAddress.toLowerCase());

    return NextResponse.json({ success: true, transactionHash: transaction.transactionHash });
  } catch (error) {
    console.error("Minting failed:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
