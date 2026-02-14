// app/api/admin/create-channels/route.ts (PLURAL - creates 4)
import { NextRequest, NextResponse } from 'next/server';
import { townsEnv } from '@towns-protocol/sdk';
import { connectTowns } from '@towns-protocol/react-sdk';
import { createThirdwebClient } from 'thirdweb';
import { privateKeyToAccount } from 'thirdweb/wallets';
import { base } from 'thirdweb/chains';
import { ethers5Adapter } from 'thirdweb/adapters/ethers5';

const CHANNEL_DEFINITIONS = [
  {
    name: 'knead-contributors',
    description: 'All contributor messages (text only)',
    key: 'contributors',
  },
  {
    name: 'knead-participants-a',
    description: 'Participant messages during events (shard A: address 0-7)',
    key: 'participantsA',
  },
  {
    name: 'knead-participants-b',
    description: 'Participant messages during events (shard B: address 8-f)',
    key: 'participantsB',
  },
  {
    name: 'knead-files',
    description: 'All file uploads and IPFS content',
    key: 'files',
  },
];

export async function POST(request: NextRequest) {
  try {
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

    // Create all 4 channels
    const channels: Record<string, string> = {};

    for (const def of CHANNEL_DEFINITIONS) {
      console.log(`Creating channel: ${def.name}`);
      const channelId = await space.createChannel(
        def.name,
        def.description,
        signer
      );
      channels[def.key] = channelId;
      console.log(`✅ Created ${def.name}: ${channelId}`);
      
      // Wait 2 seconds between creates to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Disconnect
    agent.stop();

    return NextResponse.json({
      success: true,
      channels,
    });

  } catch (error) {
    console.error('Error creating channels:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
