import { NextRequest, NextResponse } from 'next/server';
import { townsEnv } from '@towns-protocol/sdk';
import { connectTowns } from '@towns-protocol/react-sdk';
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

    // Validate private key format
    if (adminPrivateKey.length !== 64 && adminPrivateKey.length !== 66) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'ADMIN_PRIVATE_KEY must be 64 hex characters (with or without 0x prefix)' 
        },
        { status: 400 }
      );
    }

    // Create ThirdWeb client and signer
    const client = createThirdwebClient({
      clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
    });

    // Ensure 0x prefix
    const formattedPrivateKey = adminPrivateKey.startsWith('0x') 
      ? adminPrivateKey 
      : `0x${adminPrivateKey}`;

    const account = privateKeyToAccount({
      client,
      privateKey: formattedPrivateKey as `0x${string}`,
    });

    const signer = await ethers5Adapter.signer.toEthers({
      client,
      chain: base,
      account,
    });

    // Connect to Towns
    const townsConfig = townsEnv().makeTownsConfig('omega');
    const agent = await connectTowns(signer, { 
      townsConfig,
    });

    // Join space
    const spaceId = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID!;
    const space = await agent.spaces.getSpace(spaceId);
    
    // Check if already a member, if not join
    const isMember = await space.isMember(signer.getAddress());
    if (!isMember) {
      await space.joinSpace(signer);
    }

    // Create the channel
    const channelId = await space.createChannel(
      name,
      description || '',
      signer
    );

    // Disconnect
    agent.stop();

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
