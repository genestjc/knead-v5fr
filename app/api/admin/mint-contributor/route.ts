import { NextRequest, NextResponse } from "next/server";
import { getContract, prepareContractCall, Engine } from "thirdweb";
import { base } from "thirdweb/chains";
import { client, serverWallet } from "@/thirdweb-server-wallet";

const isAddress = (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address);

const getRoleToTokenId = (role: string): bigint | null => {
  const roleMap: Record<string, bigint> = {
    'appointed': 1n,
    'invited': 2n,
    'earned': 3n,
  };
  return roleMap[role] || null;
};

export async function POST(req: NextRequest) {
  try {
    const CONTRIBUTOR_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS;
    const MASTER_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET;

    if (!CONTRIBUTOR_CONTRACT_ADDRESS || !MASTER_ADMIN_ADDRESS) {
      return NextResponse.json({ 
        success: false, 
        error: "Server configuration error: Missing environment variables" 
      }, { status: 500 });
    }

    const { recipientAddress, role, adminAddress } = await req.json();

    if (!recipientAddress || !role || !adminAddress) {
      return NextResponse.json({ 
        success: false, 
        error: "Missing required fields." 
      }, { status: 400 });
    }

    if (!isAddress(recipientAddress) || !isAddress(adminAddress)) {
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

    const tokenId = getRoleToTokenId(role);
    if (!tokenId) {
      return NextResponse.json({ 
        success: false, 
        error: "Invalid role specified." 
      }, { status: 400 });
    }

    const contract = getContract({
      client,
      address: CONTRIBUTOR_CONTRACT_ADDRESS,
      chain: base,
    });

    // Use your contract's adminMintContributor function
    const transaction = prepareContractCall({
      contract,
      method: "function adminMintContributor(address to, uint256 tokenId)",
      params: [recipientAddress, tokenId],
      gasLimit: 300000n,
    });

    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
    });

    const { transactionHash } = await Engine.waitForTransactionHash({
      client,
      transactionId,
    });

    return NextResponse.json({ 
      success: true, 
      transactionHash,
      transactionId,
      tokenId: Number(tokenId),
      role: role
    });

  } catch (error) {
    console.error("Minting failed:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}
