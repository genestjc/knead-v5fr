import { NextRequest, NextResponse } from "next/server";
import { getContract, readContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { client } from "@/thirdweb-server-wallet";

const SPACE_OWNER_CONTRACT_ADDRESS = '0x2824D1235d1CbcA6d61C00C3ceeCB9155cd33a42';

export async function POST(req: NextRequest) {
  try {
    const { spaceId } = await req.json();

    if (!spaceId) {
      return NextResponse.json({ error: 'Missing spaceId' }, { status: 400 });
    }

    console.log('🔍 Checking Space Owner NFT');
    console.log(`   Raw Space ID: ${spaceId}`);

    // Ensure the Space ID has proper 0x prefix and is a valid address
    let normalizedSpaceId = spaceId;
    if (!spaceId.startsWith('0x')) {
      normalizedSpaceId = `0x${spaceId}`;
    }

    console.log(`   Normalized Space ID: ${normalizedSpaceId}`);

    // Validate it's a proper Ethereum address (42 characters with 0x)
    if (normalizedSpaceId.length !== 42) {
      console.error(`   Invalid address length: ${normalizedSpaceId.length}`);
      return NextResponse.json({ 
        error: `Invalid Space ID format. Expected 42 characters, got ${normalizedSpaceId.length}` 
      }, { status: 400 });
    }

    // Query the Space contract directly for its owner
    const spaceContract = getContract({
      client,
      chain: base,
      address: normalizedSpaceId,
    });

    console.log('   Querying Space contract for owner...');
    const owner = await readContract({
      contract: spaceContract,
      method: "function owner() view returns (address)",
      params: [],
    });

    console.log(`   Space owner: ${owner}`);

    // Now find the token ID from the SpaceOwner NFT contract
    const spaceOwnerContract = getContract({
      client,
      chain: base,
      address: SPACE_OWNER_CONTRACT_ADDRESS,
    });

    console.log('   Checking SpaceOwner NFT balance...');
    const balance = await readContract({
      contract: spaceOwnerContract,
      method: "function balanceOf(address owner) view returns (uint256)",
      params: [owner],
    });

    console.log(`   Owner has ${balance} Space Owner NFTs`);

    let tokenId = null;
    if (balance > 0n) {
      console.log('   Getting first token ID...');
      tokenId = await readContract({
        contract: spaceOwnerContract,
        method: "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
        params: [owner, 0n],
      });
      console.log(`   Token ID: ${tokenId}`);
    }

    console.log('✅ Successfully retrieved owner info');

    return NextResponse.json({
      spaceId: normalizedSpaceId,
      currentOwner: owner,
      tokenId: tokenId ? tokenId.toString() : null,
      balance: balance.toString(),
    });

  } catch (error: any) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Error checking owner:', error);
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return NextResponse.json(
      { error: error.message || 'Failed to check owner' },
      { status: 500 }
    );
  }
}
