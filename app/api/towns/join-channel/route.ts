import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers-v5';
import { townsEnv, makeStreamRpcClient } from '@towns-protocol/sdk';

const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL!;

export async function POST(req: NextRequest) {
  try {
    const { channelId, botPrivateKey } = await req.json();
    
    if (!channelId || !botPrivateKey) {
      return NextResponse.json(
        { error: 'Missing channelId or botPrivateKey' },
        { status: 400 }
      );
    }
    
    console.log('🤖 Bot joining channel:', channelId.substring(0, 16) + '...');
    
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const botWallet = new ethers.Wallet(botPrivateKey, provider);
    
    console.log('   Bot address:', botWallet.address);
    
    const townsConfig = townsEnv().makeTownsConfig('omega', { rpcUrl: RPC_URL });
    
    // Create stream RPC client
    const streamClient = makeStreamRpcClient(townsConfig.riverConfig);
    
    // Join the channel stream
    await streamClient.joinStream(channelId, botWallet);
    
    console.log('✅ Bot successfully joined channel!');
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('❌ Join channel error:', error.message);
    
    // Treat "already joined" as success
    if (error.message?.includes('already') || 
        error.message?.includes('member') ||
        error.message?.includes('joined')) {
      console.log('✅ Bot already in channel');
      return NextResponse.json({ success: true, alreadyMember: true });
    }
    
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}
