import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// SpaceFactory contract address on Base mainnet
const SPACE_FACTORY_ADDRESS = '0x9978c826d93883701522d2ca645d5436e5654252';

// Minimal ABI - just the createSpace function
const SPACE_FACTORY_ABI = [
  'function createSpace(string name) external returns (uint256 spaceId)',
  'event SpaceCreated(uint256 indexed spaceId, address indexed owner, string name)',
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { spaceName } = body;

    if (!spaceName) {
      return NextResponse.json(
        { success: false, error: 'Space name is required' },
        { status: 400 }
      );
    }

    // Check for private key
    if (!process.env.THIRDWEB_PRIVATE_KEY) {
      return NextResponse.json(
        { success: false, error: 'Server wallet not configured' },
        { status: 500 }
      );
    }

    console.log('🚀 Creating Towns space via SpaceFactory contract...');

    // Connect to Base mainnet
    const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
    const wallet = new ethers.Wallet(process.env.THIRDWEB_PRIVATE_KEY, provider);

    console.log('Server wallet:', wallet.address);

    // Connect to SpaceFactory contract
    const spaceFactory = new ethers.Contract(
      SPACE_FACTORY_ADDRESS,
      SPACE_FACTORY_ABI,
      wallet
    );

    console.log('Calling createSpace...');

    // Create the space
    const tx = await spaceFactory.createSpace(spaceName);
    console.log('Transaction sent:', tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log('Transaction confirmed:', receipt.transactionHash);

    // Find the SpaceCreated event
    const spaceCreatedEvent = receipt.events?.find(
      (e: any) => e.event === 'SpaceCreated'
    );

    if (!spaceCreatedEvent) {
      throw new Error('SpaceCreated event not found in transaction');
    }

    const spaceId = spaceCreatedEvent.args.spaceId.toString();
    console.log('✅ Space created! ID:', spaceId);

    // The default channel is typically the space ID + a suffix
    // We might need to query this differently
    const defaultChannelId = spaceId; // Placeholder - may need adjustment

    return NextResponse.json({
      success: true,
      spaceId,
      defaultChannelId,
      transactionHash: receipt.transactionHash,
    });

  } catch (error: any) {
    console.error('❌ Error creating space:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to create space',
        details: error.reason || error.data?.message 
      },
      { status: 500 }
    );
  }
}
