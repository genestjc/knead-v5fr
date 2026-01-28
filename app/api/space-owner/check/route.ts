
import { NextRequest, NextResponse } from "next/server";
import { getContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { client } from "@/thirdweb-server-wallet";
import { readContract } from "thirdweb";

const SPACE_OWNER_CONTRACT_ADDRESS = '0x2824D1235d1CbcA6d61C00C3ceeCB9155cd33a42';

export async function POST(req: NextRequest) {
  try {
    const { spaceId } = await req.json();

    if (!spaceId) {
      return NextResponse.json({ error: 'Missing spaceId' }, { status: 400 });
    }

    console.log('🔍 Checking Space Owner NFT for:', spaceId);

    const contract = getContract({
      client,
      chain: base,
      address: SPACE_OWNER_CONTRACT_ADDRESS,
    });

    // Get token ID from space ID (they should match 1:1)
    // The tokenId is derived from the space address
    const spaceAddress = spaceId; // Space ID is the space contract address
    
    // Read the owner of this token
    const ownerOf = await readContract({
      contract,
      method: "function ownerOf(uint256 tokenId) view returns (address)",
      params: [BigInt(spaceAddress)], // Convert space address to token ID
    });

    console.log('✅ Current owner:', ownerOf);

    return NextResponse.json({
      tokenId: spaceAddress,
      currentOwner: ownerOf,
      spaceId,
    });

  } catch (error: any) {
    console.error('❌ Error checking owner:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check owner' },
      { status: 500 }
    );
  }
}
