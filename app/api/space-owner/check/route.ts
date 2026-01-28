// app/api/space-owner/check/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getContract, readContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { client } from "@/thirdweb-server-wallet";

export async function POST(req: NextRequest) {
  try {
    const { spaceId } = await req.json();

    if (!spaceId) {
      return NextResponse.json({ error: 'Missing spaceId' }, { status: 400 });
    }

    console.log('🔍 Checking Space Owner for:', spaceId);

    // Query the Space contract directly (spaceId IS the space contract address)
    const spaceContract = getContract({
      client,
      chain: base,
      address: spaceId, // The space contract address
    });

    // Read the owner from the Space contract
    const owner = await readContract({
      contract: spaceContract,
      method: "function owner() view returns (address)",
      params: [],
    });

    console.log('✅ Current owner:', owner);

    // Now find the token ID from the SpaceOwner NFT contract
    const spaceOwnerContract = getContract({
      client,
      chain: base,
      address: '0x2824D1235d1CbcA6d61C00C3ceeCB9155cd33a42',
    });

    // Get how many tokens this owner has
    const balance = await readContract({
      contract: spaceOwnerContract,
      method: "function balanceOf(address owner) view returns (uint256)",
      params: [owner],
    });

    console.log(`   Owner has ${balance} Space Owner NFTs`);

    // Get the first token ID (assuming they only have one or we want the first)
    let tokenId = null;
    if (balance > 0n) {
      tokenId = await readContract({
        contract: spaceOwnerContract,
        method: "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
        params: [owner, 0n], // Get first token
      });
      console.log(`   Token ID: ${tokenId}`);
    }

    return NextResponse.json({
      spaceId,
      currentOwner: owner,
      tokenId: tokenId ? tokenId.toString() : null,
      balance: balance.toString(),
    });

  } catch (error: any) {
    console.error('❌ Error checking owner:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check owner' },
      { status: 500 }
    );
  }
}
