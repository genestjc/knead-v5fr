import { NextRequest, NextResponse } from 'next/server';
import { townsEnv } from '@towns-protocol/sdk';
import { makeRiverConnection } from '@river-build/sdk';
import { createThirdwebClient } from 'thirdweb';
import { privateKeyToAccount } from 'thirdweb/wallets';
import { base } from 'thirdweb/chains';
import { ethers5Adapter } from 'thirdweb/adapters/ethers5';

export async function POST(request: NextRequest) {
  try {
    const { name, description } = await request.json();

    // Validate inputs
    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Channel name is required' },
        { status: 400 }
      );
    }

    // Check for admin private key
    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    if (!adminPrivateKey) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'ADMIN_PRIVATE_KEY not configured. Add it to Vercel environment variables temporarily.' 
        },
        { status: 500 }
      );
    }

    // Create ThirdWeb client and signer
    const client = createThirdwebClient({
      clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
    });

    const account = privateKeyToAccount({
      client,
      privateKey: adminPrivateKey,
    });

    const signer = await ethers5Adapter.signer.toEthers({
      client,
      chain: base,
      account,
    });

    // Connect to Towns
    const townsConfig = townsEnv().makeTownsConfig('omega');
    const riverConnection = makeRiverConnection(
      signer,
      townsConfig.river,
      undefined,
      { environmentId: 'omega' }
    );

    await riverConnection.connect();

    // Join space
    const spaceId = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID!;
    const space = await riverConnection.joinSpace(spaceId);
    await space.waitFor(() => space.initialized);

    // Create the channel
    const channelId = await space.createChannel(
      name,
      description || '',
      signer
    );

    // Disconnect
    await riverConnection.disconnect();

    return NextResponse.json({
      success: true,
      channelId,
    });

  } catch (error) {
    console.error('Error creating channel:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
