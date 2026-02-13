/**
 * API Route: Create Virtual Sharding Channels
 * 
 * Creates the 4 channels needed for the virtual sharding system:
 * 1. knead-contributors - Text messages from contributors
 * 2. knead-participants-a - Text from participants (address 0-7)
 * 3. knead-participants-b - Text from participants (address 8-f)
 * 4. knead-files - All file uploads
 * 
 * This is a one-time setup endpoint. Should be run once during deployment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { connectTowns, townsEnv } from '@towns-protocol/sdk';

export const dynamic = 'force-dynamic';

interface CreateChannelsResponse {
  success: boolean;
  message?: string;
  error?: string;
  channels?: {
    contributors: string;
    participantsA: string;
    participantsB: string;
    files: string;
  };
}

export async function POST(req: NextRequest): Promise<NextResponse<CreateChannelsResponse>> {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏗️ CREATING VIRTUAL SHARDING CHANNELS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Check if channels already exist
    const existingChannels = {
      contributors: process.env.NEXT_PUBLIC_CHANNEL_CONTRIBUTORS,
      participantsA: process.env.NEXT_PUBLIC_CHANNEL_PARTICIPANTS_A,
      participantsB: process.env.NEXT_PUBLIC_CHANNEL_PARTICIPANTS_B,
      files: process.env.NEXT_PUBLIC_CHANNEL_FILES,
    };

    const hasExistingChannels = Object.values(existingChannels).some(Boolean);
    
    if (hasExistingChannels) {
      console.log('⚠️ Channels already configured');
      return NextResponse.json<CreateChannelsResponse>({
        success: false,
        error: 'Channels already exist. Check environment variables.',
        channels: existingChannels as any,
      }, { status: 400 });
    }

    // Get configuration
    const SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID;
    const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
    const BASE_RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';

    if (!SPACE_ID) {
      return NextResponse.json<CreateChannelsResponse>({
        success: false,
        error: 'Missing NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID environment variable',
      }, { status: 500 });
    }

    if (!ADMIN_PRIVATE_KEY) {
      return NextResponse.json<CreateChannelsResponse>({
        success: false,
        error: 'Missing ADMIN_PRIVATE_KEY environment variable. Add it to Vercel settings.',
      }, { status: 500 });
    }

    console.log('📋 Configuration:');
    console.log(`   Space ID: ${SPACE_ID}`);
    console.log(`   RPC URL: ${BASE_RPC_URL}`);

    // Create wallet and connect to Towns
    const provider = new ethers.providers.JsonRpcProvider(BASE_RPC_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    
    console.log(`   Admin Address: ${wallet.address}`);

    const townsConfig = townsEnv().makeTownsConfig('omega', {
      rpcUrl: BASE_RPC_URL,
    });

    console.log('🔌 Connecting to Towns Protocol...');
    const agent = await connectTowns(wallet, { townsConfig });
    console.log('✅ Connected to Towns Protocol');

    // Get space
    console.log('📍 Getting space...');
    const space = await agent.spaces.getSpace(SPACE_ID);
    console.log(`   Space: ${space.metadata?.name || 'Unknown'}`);

    // Create the 4 channels
    console.log('\n📺 Creating channels...');

    const channelNames = [
      { name: 'knead-contributors', description: 'Messages from contributors' },
      { name: 'knead-participants-a', description: 'Messages from participants (0-7)' },
      { name: 'knead-participants-b', description: 'Messages from participants (8-f)' },
      { name: 'knead-files', description: 'File uploads and IPFS content' },
    ];

    const createdChannels: string[] = [];

    for (const { name, description } of channelNames) {
      try {
        console.log(`   Creating ${name}...`);
        
        // Create channel in the space
        const channel = await space.createChannel({
          channelName: name,
          metadata: {
            name,
            description,
            created: new Date().toISOString(),
          },
        });

        const channelId = channel.id;
        createdChannels.push(channelId);
        
        console.log(`   ✅ ${name}: ${channelId}`);
      } catch (error: any) {
        console.error(`   ❌ Failed to create ${name}:`, error.message);
        throw new Error(`Failed to create channel ${name}: ${error.message}`);
      }
    }

    // Disconnect agent
    agent.stop();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ALL CHANNELS CREATED SUCCESSFULLY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const channelIds = {
      contributors: createdChannels[0],
      participantsA: createdChannels[1],
      participantsB: createdChannels[2],
      files: createdChannels[3],
    };

    console.log('\n📋 Add these to your Vercel environment variables:');
    console.log(`NEXT_PUBLIC_CHANNEL_CONTRIBUTORS=${channelIds.contributors}`);
    console.log(`NEXT_PUBLIC_CHANNEL_PARTICIPANTS_A=${channelIds.participantsA}`);
    console.log(`NEXT_PUBLIC_CHANNEL_PARTICIPANTS_B=${channelIds.participantsB}`);
    console.log(`NEXT_PUBLIC_CHANNEL_FILES=${channelIds.files}`);

    return NextResponse.json<CreateChannelsResponse>({
      success: true,
      message: 'Channels created successfully',
      channels: channelIds,
    });

  } catch (error: any) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ ERROR CREATING CHANNELS');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return NextResponse.json<CreateChannelsResponse>({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

// Also support GET for easy browser testing
export async function GET(req: NextRequest): Promise<NextResponse<CreateChannelsResponse>> {
  return POST(req);
}
